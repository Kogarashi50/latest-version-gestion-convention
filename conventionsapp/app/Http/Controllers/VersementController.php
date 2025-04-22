<?php

namespace App\Http\Controllers;

use App\Models\Versement;
use App\Models\EngagementFinancier;
use App\Models\Projet; // Needed for fetching partners by project
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator; // Using Facade for validation here
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use Exception; // Catch generic exceptions
use Illuminate\Support\Facades\Log; 
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class VersementController extends Controller
{
    /**
     * Display a listing of the resource.
     * Handles fetching data for the DynamicTable.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */

        /**
         * Display a listing of the resource.
         * Handles fetching data for the DynamicTable.
         *
         * @param \Illuminate\Http\Request $request
         * @return \Illuminate\Http\JsonResponse
         */
        public function index(Request $request)
        {
            try {
                Log::debug("Fetching versements list..."); // Log entry point
    
                // Eager load relationships WITHOUT specific select clauses initially
                $query = Versement::with([
                    'engagementFinancier.projet', // Load full Projet model via engagementFinancier
                    'engagementFinancier.partenaire' // Load full Partenaire model via engagementFinancier
                    // engagementFinancier itself is loaded implicitly by requesting nested relations
                ]);
    
                // Basic Sorting (Adapt based on DynamicTable needs)
                $sortBy = $request->query('sortBy', 'date_versement');
                $sortOrder = $request->query('sortOrder', 'desc');
                if (Schema::hasColumn('versements', $sortBy)) { // Basic check if column exists
                     $query->orderBy($sortBy, $sortOrder);
                } else {
                     $query->orderBy('date_versement', 'desc'); // Default fallback
                     Log::warning("Attempted to sort by invalid column: {$sortBy}");
                }
    
    
                // Basic Search/Filtering (Adapt based on DynamicTable specific filter structure)
                if ($request->has('search') && !empty($request->search)) {
                    $searchTerm = '%' . $request->search . '%';
                    Log::debug("Applying search term: " . $searchTerm);
                    $query->where(function ($q) use ($searchTerm) {
                        $q->where('moyen_paiement', 'like', $searchTerm)
                          ->orWhere('reference_paiement', 'like', $searchTerm)
                          ->orWhere('commentaire', 'like', $searchTerm)
                          ->orWhereHas('engagementFinancier.projet', function($subQ) use ($searchTerm) {
                              $subQ->where('Nom_Projet', 'like', $searchTerm)
                                   ->orWhere('Code_Projet', 'like', $searchTerm);
                          })
                          ->orWhereHas('engagementFinancier.partenaire', function($subQ) use ($searchTerm) {
                              $subQ->where('Description', 'like', $searchTerm)
                                   ->orWhere('Code', 'like', $searchTerm)->orWhere('Description_Arr', 'like', $searchTerm);;
                          });
                    });
                }
    
    
                // Pagination (Adapt based on DynamicTable needs)
                $perPage = $request->query('perPage', 10);
                $versements = $query->paginate($perPage);
    
                // Log the structure being sent - CRITICAL FOR DEBUGGING
                Log::debug('Versements data structure before response:', $versements->toArray());
    
                // Return JSON structure expected by DynamicTable
                return response()->json([
                    // Ensure this key matches frontend DynamicTable 'dataKey' config
                    'versements' => $versements->items(),
                    'pagination' => [
                        'currentPage' => $versements->currentPage(),
                        'totalPages' => $versements->lastPage(),
                        'totalItems' => $versements->total(),
                        'perPage' => $versements->perPage(),
                    ],
                ]);
    
            } catch (Exception $e) {
                Log::error('Error fetching versements: ' . $e->getMessage(), ['exception' => $e]);
                return response()->json(['message' => 'Erreur lors de la récupération des versements.'], 500);
            }
        }
    
    /**
     * Store a newly created resource in storage.
     * Handles the creation form submission.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        // --- Validation Rules ---
        $validator = Validator::make($request->all(), [
            'engagement_id' => 'required|integer|exists:engagements_financiers,id',
            'date_versement' => 'required|date_format:Y-m-d',
            'montant_verse' => 'required|numeric|min:0.01', // Must be positive
            'moyen_paiement' => 'required|string|max:50',
            'reference_paiement' => 'nullable|string|max:100',
            'commentaire' => 'nullable|string',
        ], [ /* Custom messages */
            'engagement_id.required' => 'L\'engagement financier est requis.',
            'engagement_id.exists' => 'L\'engagement financier sélectionné est invalide.',
            'date_versement.required' => 'La date de versement est requise.',
            'date_versement.date_format' => 'Le format de la date de versement doit être AAAA-MM-JJ.',
            'montant_verse.required' => 'Le montant versé est requis.',
            'montant_verse.numeric' => 'Le montant versé doit être un nombre.',
            'montant_verse.min' => 'Le montant versé doit être positif.',
            'moyen_paiement.required' => 'Le moyen de paiement est requis.',
            'moyen_paiement.max' => 'Le moyen de paiement ne doit pas dépasser 50 caractères.',
            'reference_paiement.max' => 'La référence de paiement ne doit pas dépasser 100 caractères.',
         ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Erreurs de validation.', 'errors' => $validator->errors()], 422);
        }

        // ** GET VALIDATED DATA FIRST **
        $validatedData = $validator->validated();
        $engagementId = $validatedData['engagement_id'];         // <-- Assign engagementId HERE
        $newMontantVerse = (float) $validatedData['montant_verse']; // <-- Assign newMontantVerse HERE

        try {
            // --- Check Amount Limit ---
            // Fetch the related engagement using the validated ID
            $engagement = EngagementFinancier::findOrFail($engagementId);
            $montantEngage = (float) $engagement->montant_engage;

            // Calculate sum of *existing* versements for this engagement
            $totalDejaVerse = (float) Versement::where('engagement_id', $engagementId)->sum('montant_verse');

            // Calculate potential new total
            $nouveauTotal = $totalDejaVerse + $newMontantVerse;

            // Use a small tolerance for float comparison
            $tolerance = 0.001;

            Log::debug("Versement Store Check: Engagement ID {$engagementId}, Engagé={$montantEngage}, Déjà Versé={$totalDejaVerse}, Nouveau Montant={$newMontantVerse}, Nouveau Total={$nouveauTotal}");

            if (($nouveauTotal - $montantEngage) > $tolerance) {
                 // Exceeds the limit
                 $depassement = $nouveauTotal - $montantEngage;
                 $maxAutorise = $montantEngage - $totalDejaVerse;
                 $maxAutoriseFormatted = number_format(max(0, $maxAutorise), 2, ',', ' ');

                 Log::warning("Versement Store Rejected: Amount limit exceeded for Engagement ID {$engagementId}.");

                 return response()->json([
                     'message' => 'Le montant dépasse l\'engagement.', // Keep main message concise
                     'errors' => [
                         'montant_verse' => [ // Associate error with the field
                             "Le montant total versé (".formatCurrency($nouveauTotal, '0')." MAD) dépasserait le montant engagé (".formatCurrency($montantEngage, '0')." MAD). Montant maximum autorisé pour ce versement: {$maxAutoriseFormatted} MAD."
                         ]
                     ]
                 ], 422); // Use 422 for validation-like errors
            }
            // --- End Check Amount Limit ---

            // Limit check passed, create the Versement using ALL validated data
            $versement = Versement::create($validatedData);

            // Eager load relationships for the response
            $versement->load([
                'engagementFinancier:id,montant_engage,projet_id,partenaire_id', // Include montant_engage
                'engagementFinancier.projet:ID_Projet,Code_Projet,Nom_Projet',
                'engagementFinancier.partenaire:Id,Code,Description,Description_Arr' // Use correct PK 'Id'
            ]);

            return response()->json([
                'message' => 'Versement créé avec succès!',
                'versement' => $versement
            ], 201);

        } catch (ModelNotFoundException $e) {
             // This catch is mainly for the EngagementFinancier::findOrFail if validation somehow missed it
             Log::error("Versement Store Error: EngagementFinancier ID {$engagementId} not found after validation passed.");
             return response()->json(['message' => 'Erreur: Engagement financier associé non trouvé.'], 404);
        } catch (Exception $e) {
            Log::error('Error creating versement: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json(['message' => 'Erreur serveur lors de la création du versement.'], 500);
        }
    }
    /**
     * Display the specified resource.
     * Handles fetching data for the "View" modal/page.
     *
     * @param  int  $id The ID of the Versement
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, $id) // Add Request parameter
    {
        try {
             // Check if frontend specifically asked for engagement details via query parameter
             $withDetails = $request->query('include') === 'engagementDetails';

            $query = Versement::query(); // Start query builder

            // Always load the basic engagement relationship to get its ID
            $query->with(['engagementFinancier:id,montant_engage,projet_id,partenaire_id', 'engagementFinancier.projet:ID_Projet,Code_Projet,Nom_Projet', // Select necessary project fields
            'engagementFinancier.partenaire:Id,Code,Description,Description_Arr']); // Select needed fields

           
            // If not $withDetails, only 'engagementFinancier:id,montant_engage...' is loaded


             $versement = $query->findOrFail($id); // Execute the query and find the versement

             // Prepare the base response data
             $responseData = ['versement' => $versement];

             // If engagement data was loaded (it always should be if versement exists)
             // AND details were requested, calculate and add the total paid amount
             if ($withDetails && $versement->engagementFinancier) {
                 // Calculate the total paid for the associated engagement
                 // Ensure engagement_id is accessed correctly from the loaded relation
                 $totalDejaVersePourEngagement = Versement::where('engagement_id', $versement->engagement_id)
                                                          ->sum('montant_verse');
                 // Add this info directly to the top level of the response for the frontend
                 $responseData['total_deja_verse_pour_engagement'] = $totalDejaVersePourEngagement ?? 0;

                 Log::debug("Show Versement ID {$id} with details: Total Versé for Engagement {$versement->engagement_id} = {$responseData['total_deja_verse_pour_engagement']}");

             } else if ($versement->engagementFinancier) {
                  Log::debug("Show Versement ID {$id} without extra details.");
             } else {
                 Log::warning("Versement ID {$id} loaded, but engagementFinancier relation is missing!");
             }


            return response()->json($responseData);

        } catch (ModelNotFoundException $e) {
            Log::warning("Versement ID {$id} not found.");
            return response()->json(['message' => 'Versement non trouvé.'], 404);
        } catch (Exception $e) {
            Log::error("Error fetching versement ID {$id}: " . $e->getMessage(), ['exception' => $e]);
            return response()->json(['message' => 'Erreur serveur lors de la récupération du versement.'], 500);
        }
    }
    /**
     * Update the specified resource in storage.
     * Handles the edit form submission.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id The ID of the Versement to update
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        // --- Validation Rules (similar to store, but engagement_id might not change) ---
        $validator = Validator::make($request->all(), [
            // engagement_id is less likely to change, but allow it if needed
             'engagement_id' => 'sometimes|required|integer|exists:engagements_financiers,id',
             'date_versement' => 'sometimes|required|date_format:Y-m-d',
             'montant_verse' => 'sometimes|required|numeric|min:0',
             'moyen_paiement' => 'sometimes|required|string|max:50',
             'reference_paiement' => 'nullable|string|max:100',
             'commentaire' => 'nullable|string',
        ], [ /* Custom error messages - same as store */ ]);

         if ($validator->fails()) {
             return response()->json(['message' => 'Erreurs de validation.', 'errors' => $validator->errors()], 422);
         }
         $validatedData = $validator->validated();

        try {
            $versement = Versement::with('engagementFinancier')->findOrFail($id); 
            $engagementId = $validatedData['engagement_id'] ?? $versement->engagement_id; // Use new ID if provided, else existing
            $newMontantVerse = isset($validatedData['montant_verse']) ? (float)$validatedData['montant_verse'] : (float)$versement->montant_verse; // Use new amount if provided
            $originalMontantVerse = (float)$versement->montant_verse;
            // Update only the validated fields that were passed in the request
            if (isset($validatedData['montant_verse']) || isset($validatedData['engagement_id'])) {
                // If engagement ID changed, we need to fetch the new one
                $engagement = ($engagementId == $versement->engagement_id)
                               ? $versement->engagementFinancier
                               : EngagementFinancier::findOrFail($engagementId);

                $montantEngage = (float) $engagement->montant_engage;

                // Calculate sum of OTHER existing versements (exclude the one being updated)
                $totalAutresVersements = (float) Versement::where('engagement_id', $engagementId)
                                                           ->where('id', '!=', $id) // Exclude current record
                                                           ->sum('montant_verse');

                // Calculate potential new total including the updated amount
                $nouveauTotal = $totalAutresVersements + $newMontantVerse;
                $tolerance = 0.001;

                Log::debug("Versement Update Check: Versement ID {$id}, Engagement ID {$engagementId}, Engagé={$montantEngage}, Autres Versés={$totalAutresVersements}, Nouveau Montant={$newMontantVerse}, Nouveau Total={$nouveauTotal}");

                if (($nouveauTotal - $montantEngage) > $tolerance) {
                    // Exceeds the limit
                    $maxAutorise = $montantEngage - $totalAutresVersements;
                    $maxAutoriseFormatted = number_format(max(0, $maxAutorise), 2, ',', ' ');

                    Log::warning("Versement Update Rejected: Amount limit exceeded for Engagement ID {$engagementId}.");

                    return response()->json([
                        'message' => 'Le montant dépasse l\'engagement.',
                        'errors' => [
                            'montant_verse' => [
                                "Le montant total versé ({$nouveauTotal} MAD) dépasserait le montant engagé ({$montantEngage} MAD). Montant maximum autorisé pour ce versement: {$maxAutoriseFormatted} MAD."
                            ]
                        ]
                    ], 422);
                }
           }
           // --- End Check Amount Limit ---

           // Limit check passed (or not needed), update the Versement
           $versement->update($validatedData);

           // Eager load relationships for the response
           $versement->load([
               'engagementFinancier:id,montant_engage,projet_id,partenaire_id', // Add montant_engage
               'engagementFinancier.projet:ID_Projet,Code_Projet,Nom_Projet',
               'engagementFinancier.partenaire:Id,Code,Description,Description_Arr'
           ]);

           return response()->json([
               'message' => 'Versement mis à jour avec succès!',
               'versement' => $versement
           ]);

       } catch (ModelNotFoundException $e) {
            Log::error("Versement Update Error: Versement ID {$id} or related Engagement not found.");
            return response()->json(['message' => 'Versement ou Engagement associé non trouvé.'], 404);
       } catch (Exception $e) {
           Log::error("Error updating versement ID {$id}: " . $e->getMessage(), ['exception' => $e]);
           return response()->json(['message' => 'Erreur serveur lors de la mise à jour du versement.'], 500);
       }
    }

    /**
     * Remove the specified resource from storage.
     * Handles the delete action.
     *
     * @param  int  $id The ID of the Versement to delete
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy($id)
    {
        try {
            $versement = Versement::findOrFail($id);
            $versement->delete();

            return response()->json(['message' => 'Versement supprimé avec succès!']); // Or 204 No Content

        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Versement non trouvé.'], 404);
        } catch (Exception $e) {
            // Catch potential foreign key constraint issues if DB is strict
            if ($e instanceof \Illuminate\Database\QueryException && str_contains($e->getMessage(), 'foreign key constraint fails')) {
                 \Log::warning("Attempted to delete versement ID {$id} which might be referenced elsewhere.");
                 return response()->json(['message' => 'Impossible de supprimer ce versement car il est peut-être lié à d\'autres enregistrements.'], 409); // 409 Conflict
            }
            \Log::error("Error deleting versement ID {$id}: " . $e->getMessage());
            return response()->json(['message' => 'Erreur lors de la suppression du versement.'], 500);
        }
    }

    // ==========================================================================
    // == HELPER METHODS FOR DYNAMIC FORM INTERACTIONS ==
    // ==========================================================================

    /**
     * Get partners who have a financial engagement for a specific project.
     * Used to populate the partner dropdown dynamically in the Versement form.
     *
     * @param  int $projetId The ID_Projet of the selected project.
     * @return \Illuminate\Http\JsonResponse
     */
    public function getEngagedPartnersForProject($projetId)
    {
        try {
            // Find engagements for the given project ID
            $engagements = EngagementFinancier::where('projet_id', $projetId)
                            ->with('partenaire:Id,Code,Description,Description_Arr') // Eager load partner details
                            ->get();

            // Extract unique partners from these engagements
            $partners = $engagements->map(function ($engagement) {
                return $engagement->partenaire; // Get the partner object
            })->filter() // Remove any null partners (if data inconsistency exists)
              ->unique('Id') // Get only unique partners based on their ID
              ->values(); // Reset array keys

            return response()->json(['partenaires' => $partners]);

        } catch (Exception $e) {
            \Log::error("Error fetching partners for project ID {$projetId}: " . $e->getMessage());
            return response()->json(['message' => 'Erreur lors de la récupération des partenaires pour ce projet.'], 500);
        }
    }


     /**
      * Get the specific engagement ID for a given Project and Partner.
      * Used by the frontend form to know which engagement_id to use when saving the Versement.
      * NOTE: This assumes ONE active engagement per project-partner pair. If multiple
      * engagements can exist, the logic needs adjustment (e.g., return multiple and let user choose).
      *
      * @param  \Illuminate\Http\Request $request (expects 'projet_id' and 'partenaire_id')
      * @return \Illuminate\Http\JsonResponse
      */
      public function getEngagementIdForProjectPartner(Request $request)
      {
          // Validate incoming request parameters
          $validator = Validator::make($request->all(), [
              'projet_id' => 'required|integer|exists:projet,ID_Projet', // Ensure table/column names are correct
              'partenaire_id' => 'required|integer|exists:partenaire,Id', // Ensure table/column names are correct
          ]);
  
           if ($validator->fails()) {
               return response()->json(['message' => 'Projet ou Partenaire manquant/invalide.', 'errors' => $validator->errors()], 400); // Bad Request
           }
  
          try {
              $projetId = $request->input('projet_id');
              $partenaireId = $request->input('partenaire_id');
  
              // Find the engagement linking this specific project and partner
              $engagement = EngagementFinancier::where('projet_id', $projetId)
                                                ->where('partenaire_id', $partenaireId)
                                                ->select('id', 'montant_engage') // Select ID and amount engaged
                                                ->first(); // Get the first matching engagement
  
              if ($engagement) {
                  // ** ADDED CALCULATION **
                  // Calculate the total already paid for THIS specific engagement
                  $totalDejaVerse = Versement::where('engagement_id', $engagement->id)->sum('montant_verse');
  
                  // ** MODIFIED RESPONSE **
                  // Return all three pieces of data needed by the frontend
                  return response()->json([
                      'engagement_id' => $engagement->id,
                      'montant_engage' => $engagement->montant_engage,
                      'total_deja_verse' => $totalDejaVerse ?? 0 // Return sum, default to 0 if null
                  ]);
              } else {
                  // No engagement found for this specific pair
                  return response()->json(['message' => 'Aucun engagement financier trouvé pour ce projet et ce partenaire.'], 404); // Not Found
              }
  
          } catch (Exception $e) {
               Log::error("Error fetching engagement details for projet {$request->input('projet_id')} / partenaire {$request->input('partenaire_id')}: " . $e->getMessage());
               return response()->json(['message' => 'Erreur lors de la récupération des détails de l\'engagement.'], 500); // Internal Server Error
          }
      }
}