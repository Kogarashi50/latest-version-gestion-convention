<?php

namespace App\Http\Controllers; // Correct namespace based on your working setup

use App\Models\VersementCP;
use App\Models\ConvPart;      // <<<--- IMPORT ConvPart model
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;



// No need for DB facade if using Eloquent sum

class VersementCPController extends Controller
{
    /**
     * Display a listing of the payments.
     * Can be filtered by 'convpart_id' query parameter.
     * NOW includes related Convention and Partenaire details.
     *
     * @param  \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        // ... Your existing index method remains unchanged ...
        $convPartId = $request->query('convpart_id');
        $logContext = $convPartId ? " pour ConvPart ID: {$convPartId}" : " (tous)";
        Log::info("API: Récupération des versements{$logContext}");
        try {
            $query = VersementCP::query()->with([ 'convPart.convention:id,code,intitule', 'convPart.partenaire:Id,Description,Description_Arr' ]);
            if ($convPartId) {
                 if (!is_numeric($convPartId)) { return response()->json(['message' => 'ID ConvPart invalide fourni pour le filtrage.'], 400); }
                 $query->where('id_CP', $convPartId);
            }
            $versements = $query->orderBy('date_versement', 'desc')->get();
            return response()->json(['versements' => $versements], 200);
        } catch (\Exception $e) {
            Log::error("API: Erreur récupération versements{$logContext}:", [ 'message' => $e->getMessage(), 'trace' => $e->getTraceAsString() ]);
            return response()->json(['message' => 'Erreur serveur lors de la récupération des versements.'], 500);
        }
    }

    /**
     * Store a newly created payment record.
     * Includes check to prevent exceeding Montant Convenu.
     *
     * @param  \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        Log::info("API: Tentative création versement.");

        // --- 1. Basic Validation ---
        $validator = Validator::make($request->all(), [
            'id_CP'              => ['required', 'integer', Rule::exists('convention_partenaire', 'Id_CP')],
            'date_versement'     => 'required|date_format:Y-m-d',
            'montant_verse'      => ['required', 'numeric', 'min:0.01', 'regex:/^\d+(\.\d{1,2})?$/'], // Must be positive
            'moyen_paiement'     => 'required|string|max:50',
            'reference_paiement' => 'nullable|string|max:100',
            'commentaire'        => 'nullable|string|max:65535',
        ], [ /* ... messages ... */ ]);

        if ($validator->fails()) {
            Log::warning("API: Échec validation création versement:", $validator->errors()->toArray());
            return response()->json(['message' => 'Données invalides fournies.', 'errors' => $validator->errors()], 422);
        }

        $validatedData = $validator->validated();
        $idCp = $validatedData['id_CP'];
        $newMontantVerse = (float) $validatedData['montant_verse']; // Get the amount being added

        try {
            // --- 2. Fetch Commitment Details & Check Existing Payments ---
            $convPart = ConvPart::find($idCp);

            if (!$convPart) {
                 Log::error("API: Échec création versement - ConvPart ID {$idCp} non trouvé post-validation.");
                 return response()->json(['message' => 'Erreur interne: Engagement non trouvé après validation.'], 500);
            }

            $montantConvenu = (float) $convPart->Montant_Convenu;
            $totalDejaVerse = (float) (VersementCP::where('id_CP', $idCp)->sum('montant_verse') ?? 0.0);

            // --- 3. Apply the Overpayment Check (Existing + New) ---
            $potentialTotal = $totalDejaVerse + $newMontantVerse;
            $tolerance = 0.001; // Tolerance for float comparison

            Log::debug("--- DEBUG: Versement Overpayment Check ---");
            Log::debug("ID_CP: " . $idCp);
            Log::debug("Montant Convenu: " . $montantConvenu);
            Log::debug("Total Déjà Versé: " . $totalDejaVerse);
            Log::debug("Nouveau Montant Versé: " . $newMontantVerse);
            Log::debug("Total Potentiel: " . $potentialTotal);
            Log::debug("Limite (Montant Convenu - Tolerance): " . ($montantConvenu - $tolerance));
            Log::debug("--- END DEBUG ---");


            // Check if the potential new total exceeds the agreed amount (allowing for tolerance)
            if ($potentialTotal > ($montantConvenu + $tolerance)) {
                 Log::warning("API: Blocage création versement pour ID_CP {$idCp} - Le nouveau total dépasserait le montant convenu.");
                 return response()->json([
                     // Customize this message
                     'message' => 'Le montant de ce versement ajouté au total déjà versé dépasse le montant convenu pour cet engagement.',
                     'errors' => [ // Structure for potential field highlighting
                         'montant_verse' => [
                             "Le total versé ne peut excéder " . number_format($montantConvenu, 2, ',', ' ') . " MAD. " .
                             "(Déjà versé: " . number_format($totalDejaVerse, 2, ',', ' ') . " MAD)"
                         ]
                     ],
                     // Include amounts for context
                     'montant_convenu' => $montantConvenu,
                     'total_deja_verse' => $totalDejaVerse,
                     'montant_actuel' => $newMontantVerse,
                 ], 422); // 422 Unprocessable Entity
            }

            // --- 4. Create the New Versement (If Check Passes) ---
            $versement = VersementCP::create($validatedData);
            Log::info("API: Versement créé avec ID: {$versement->id}, lié à ConvPart ID: {$idCp}");

            $versement->load([
                'convPart.convention:id,code,intitule',
                'convPart.partenaire:Id,Description,Description_Arr'
            ]);

            return response()->json([ 'message' => 'Versement ajouté avec succès!', 'versement' => $versement ], 201);

        } catch (\Exception $e) {
            Log::error("API: Erreur création versement (ID_CP: {$idCp}):", [ 'message' => $e->getMessage(), 'trace' => $e->getTraceAsString() ]);
            return response()->json(['message' => 'Erreur serveur lors de la création du versement.'], 500);
        }
    } // End store method

    /**
     * Display the specified payment record.
     */
    public function show(VersementCP $versement): JsonResponse
    {
        // ... Your existing show method remains unchanged ...
         Log::info("API: Récupération versement ID: {$versement->id}");
        try {
            $versement->load([
                'convPart' => function ($query) { // Load the direct commitment link
                    $query->with([
                        'convention:id,code,intitule', // Load convention details (ensure convention_id is loaded if needed)
                        'partenaire:Id,Code,Description,Description_Arr'  // Load partner details
                    ]);
                }
            ]);
            if ($versement->convPart) {
                $versement->convPart->convention_id = $versement->convPart->convention->id ?? null;
                $versement->convPart->partenaire_id = $versement->convPart->partenaire->Id ?? null;
             }
             return response()->json(['versement' => $versement], 200);
        } catch (\Exception $e) {
             Log::error("API: Erreur récupération versement ID {$versement->id}:", [ 'message' => $e->getMessage(), 'trace' => $e->getTraceAsString() ]);
             return response()->json(['message' => 'Erreur serveur lors de la récupération du versement.'], 500);
        }
    }

    /**
     * Update the specified payment record in storage.
     */
    public function update(Request $request, VersementCP $versement): JsonResponse
    {
        Log::info("API: Tentative MAJ versement ID: {$versement->id}");

        $validator = Validator::make($request->all(), [
             // Keep 'sometimes' as not all fields might be updated at once
            'date_versement'     => 'sometimes|required|date_format:Y-m-d',
            'montant_verse'      => ['sometimes','required','numeric','min:0.01','regex:/^\d+(\.\d{1,2})?$/'], // Require positive if provided
            'moyen_paiement'     => 'sometimes|required|string|max:50',
            'reference_paiement' => 'nullable|string|max:100',
            'commentaire'        => 'nullable|string|max:65535',
            // NOTE: We don't validate 'id_CP' here as we are not changing the relationship
        ], [ /* ... messages ... */ ]);

        if ($validator->fails()) {
            Log::warning("API: Échec validation MAJ versement ID {$versement->id}:", $validator->errors()->toArray());
            return response()->json(['message' => 'Données invalides fournies.', 'errors' => $validator->errors()], 422);
        }

        $validatedData = $validator->validated();
        $idCp = $versement->id_CP; // Get the ID from the existing record

        try {
            // --- Overpayment Check (if montant_verse is being updated) ---
            if (isset($validatedData['montant_verse'])) {
                $newMontantVerse = (float) $validatedData['montant_verse'];

                // Find the associated commitment (ConvPart)
                // Use the relationship already loaded or fetch if needed
                $convPart = $versement->convPart ?? ConvPart::find($idCp);

                if (!$convPart) {
                    Log::error("API: Échec MAJ versement - ConvPart ID {$idCp} non trouvé pour versement ID {$versement->id}.");
                    return response()->json(['message' => 'Erreur interne: Engagement associé non trouvé.'], 500);
                }

                $montantConvenu = (float) $convPart->Montant_Convenu;

                // Calculate the sum of OTHER payments for this commitment
                $totalVerseAutres = (float) (VersementCP::where('id_CP', $idCp)
                                                    ->where('id', '!=', $versement->id) // Exclude the current payment
                                                    ->sum('montant_verse') ?? 0.0);

                // Calculate the potential new total
                $potentialTotal = $totalVerseAutres + $newMontantVerse;
                $tolerance = 0.001; // Tolerance for float comparison

                Log::debug("--- DEBUG: Versement UPDATE Overpayment Check ---");
                Log::debug("ID_CP: " . $idCp);
                Log::debug("Versement ID being updated: " . $versement->id);
                Log::debug("Montant Convenu: " . $montantConvenu);
                Log::debug("Total Versé (AUTRES): " . $totalVerseAutres);
                Log::debug("Nouveau Montant pour ce versement: " . $newMontantVerse);
                Log::debug("Total Potentiel: " . $potentialTotal);
                Log::debug("Limite (Montant Convenu + Tolerance): " . ($montantConvenu + $tolerance));
                Log::debug("--- END DEBUG ---");


                // Check if the potential new total exceeds the agreed amount
                if ($potentialTotal > ($montantConvenu + $tolerance)) {
                    Log::warning("API: Blocage MAJ versement ID {$versement->id} - Le nouveau total dépasserait le montant convenu.");
                    return response()->json([
                        'message' => 'Le montant modifié de ce versement ajouté au total des autres versements dépasse le montant convenu.',
                        'errors' => [
                            'montant_verse' => [
                                "Le total versé ne peut excéder " . number_format($montantConvenu, 2, ',', ' ') . " MAD. " .
                                "(Total autres: " . number_format($totalVerseAutres, 2, ',', ' ') . " MAD)"
                            ]
                        ],
                        'montant_convenu' => $montantConvenu,
                        'total_autres_versements' => $totalVerseAutres,
                        'montant_propose' => $newMontantVerse,
                    ], 422); // 422 Unprocessable Entity
                }
            }
            // --- End Overpayment Check ---


            // --- Perform the update ---
            $versement->update($validatedData);
            Log::info("API: Versement MAJ avec ID: {$versement->id}");

            // Reload relationships to return the updated state
            $versement->load([
                 'convPart.convention:id,code,intitule',
                 'convPart.partenaire:Id,Description,Description_Arr'
            ]);

            return response()->json([
                 'message' => 'Versement mis à jour avec succès!',
                 'versement' => $versement
            ], 200);

        } catch (\Exception $e) {
            Log::error("API: Erreur MAJ versement ID {$versement->id}:", [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString() // Limit trace in production
            ]);
            return response()->json(['message' => 'Erreur serveur lors de la mise à jour du versement.'], 500);
        }
    } 

    /**
     * Remove the specified payment record from storage.
     */
    public function destroy(VersementCP $versement): JsonResponse
    {
        // ... Your existing destroy method remains unchanged ...
        Log::info("API: Tentative suppression versement ID: {$versement->id}");
        try {
            $versement->delete();
            Log::info("API: Versement supprimé ID: {$versement->id}");
            return response()->json(['message' => 'Versement supprimé avec succès!'], 200);
        } catch (\Exception $e) {
            Log::error("API: Erreur suppression versement ID {$versement->id}:", [ 'message' => $e->getMessage(), 'trace' => $e->getTraceAsString() ]);
            return response()->json(['message' => 'Erreur serveur lors de la suppression du versement.'], 500);
        }
    }
}