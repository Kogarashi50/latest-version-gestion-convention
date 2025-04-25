<?php

namespace App\Http\Controllers;

// Required Model imports
use App\Models\Convention;
use App\Models\Programme;
use App\Models\Projet; // Ensure Projet model is imported
use App\Models\Document;
use App\Models\ConvPart;
use App\Models\VersementCP;

use App\Models\Partenaire;
use Illuminate\Http\JsonResponse;

// Required Facades and Classes
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File; // Use File facade for filesystem operations
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;


class ConventionController extends Controller
{
    /**
     * Display a listing of the conventions.
     * GET /api/conventions
     */
    public function index()
    {
        Log::info('Récupération de toutes les conventions (multi-file handling)...');
        try {
            $conventions = Convention::with([
                    'programme',
                    'projet', // Eager load projet
                    'documents', // Eager load documents
                    'convParts.partenaire'
                ])
                ->latest()
                ->get();

            Log::info('Récupération réussie de ' . $conventions->count() . ' conventions.');
            return response()->json(['conventions' => $conventions]);
        } catch (\Exception $e) {
            Log::error('Erreur lors de la récupération des conventions:', ['message' => $e->getMessage()]);
            return response()->json(['message' => 'Erreur serveur lors de la récupération des conventions.'], 500);
        }
    }

    /**
     * Store a newly created convention.
     * POST /api/conventions
     * FILES ARE NOW OPTIONAL ON CREATE
     */
    public function getOptions(Request $request) // <<<--- ADD THIS METHOD BACK
    {
        Log::info("Fetching Convention options for dropdown...");
        try {
            // Select only necessary fields for the dropdown
            $query = Convention::select(['id', 'code', 'intitule'])
                       ->orderBy('code', 'asc'); // Order as desired

            // Add filtering if needed, e.g., only show 'active' conventions
            // $query->where('statut', '!=', 'Cloturé');

            $conventions = $query->get();

            // Map to the format expected by react-select { value, label }
            $options = $conventions->map(function ($conv) {
                $label = $conv->code;
                if (!empty($conv->intitule)) {
                    // Use the Str facade (make sure 'use Illuminate\Support\Str;' is at the top)
                    $label .= ' - ' . Str::limit($conv->intitule, 60, '...'); // Truncate label
                }
                return [
                    'value' => $conv->id,
                    'label' => $label,
                ];
            });

            Log::info("Returning " . $options->count() . " Convention options.");
            // Return JUST the options array, not nested unless frontend expects it
            return response()->json($options, 200);
            // OR if frontend expects nesting: return response()->json(['options' => $options], 200);

        } catch (\Exception $e) {
            Log::error('Error fetching Convention options: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erreur chargement options conventions.'], 500);
        }
    }
    
    public function getPartenaireOptions(Request $request, Convention $convention): JsonResponse
    {
        $conventionId = $convention->id;
        Log::info("API: Fetching Partenaire options for Convention ID: {$conventionId}");
        try {
            // Get ConvPart records for this convention, eager load the Partenaire
            $convParts = $convention->convParts()
                           ->with('partenaire:Id,Code,Description,Description_Arr') // Adjust field if partner code needed
                           ->whereHas('partenaire') // Ensure partner exists
                           ->get();

            // Extract unique partners from the ConvPart records
            $uniquePartners = $convParts->pluck('partenaire')->unique('Id')->filter(); // Get unique partners, remove nulls

            // Map unique partners to the { value, label } format
            $options = $uniquePartners->map(function ($partenaire) {
                if (!$partenaire) return null; // Extra safety check

                // Construct the label
                $label = $partenaire->Description ?: ($partenaire->Description_Arr ?: ('Partenaire ID: ' . $partenaire->Id));
                // Prepend Code if it exists
                if ($partenaire->Code) {
                    $label = $partenaire->Code . ' - ' . $label;
                }

                return [
                    'value' => $partenaire->Id, // Use 'value' key for react-select
                    'label' => $label,         // Use 'label' key for react-select
                ];
            })
            ->filter() // Remove any nulls from mapping failure
            ->sortBy('label') // Sort by the constructed label
            ->values(); // <<< ADD ->values() HERE TO GET A SIMPLE ARRAY
            Log::info("API: Returning " . $options->count() . " unique Partenaire options for Convention {$conventionId}.");
            return response()->json($options, 200); // Return simple array

        } catch (\Exception $e) {
            Log::error("Error fetching Partenaire options for Convention {$conventionId}: " . $e->getMessage());
            return response()->json(['message' => 'Erreur chargement des partenaires pour cette convention.'], 500);
        }
    }



    public function store(Request $request)
    {
        Log::info('Requête de création de convention reçue (fichiers optionnels)...');
        Log::debug('Données brutes:', $request->all());
        if ($request->hasFile('fichiers')) {
             Log::info(count($request->file('fichiers')) . ' fichier(s) reçu(s).');
        } else {
            Log::info('Aucun fichier reçu avec la clé "fichiers" (optionnel).');
        }

        // --- 1. Decode Partner Commitments JSON ---
        $partnerCommitmentsInput = json_decode($request->input('partner_commitments', '[]'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error('Échec décodage JSON engagements partenaires.', ['error' => json_last_error_msg()]);
            return response()->json(['message' => 'Format invalide pour les engagements partenaires.'], 400);
        }
        Log::debug('Engagements partenaires décodés:', $partnerCommitmentsInput);

        // --- 2. Main Laravel Validation ---
        try {
            $validatedData = $request->validate([
                // Convention Fields
                'code' => 'required|integer|unique:convention,code',
                'classification_prov' => 'required|string',
                'categorie' => 'required|string',
                'intitule' => 'required|string',
                'reference' => 'required|string',
                'annee_convention' => 'required|integer|digits:4',
                'objet' => 'required|string',
                'objectifs' => 'required|string',
                'localisation' => 'required|string',
                'maitre_ouvrage' => 'required|string',
                'partenaire' => 'nullable|string',
                'cout_global' => 'required|numeric|min:0',
                'cout_cr' => 'required|numeric|min:0',
                'statut' => 'required|string',
                'operationalisation' => 'required|string',
                'id_programme' => 'required|integer|exists:programme,Id',
                'id_projet' => 'nullable|integer|exists:projet,ID_Projet',
                'groupe' => 'required|integer',
                'rang' => 'nullable|string',
                'observations' => 'nullable|string|max:20000', // <<< ADDED Validation

                // --- Files & Partners ---
                'fichiers' => 'nullable|array', // The array itself is optional
                'fichiers.*' => 'nullable|file|mimes:pdf,doc,docx,jpg,jpeg,png,xls,xlsx', // Individual files optional + validation
                'partner_commitments' => ['required', 'string'],
            ],
            // --- Custom French Validation Messages ---
            [
                'observations.max' => 'Les observations ne doivent pas dépasser :max caractères.', 
                'required' => 'Le champ :attribute est obligatoire.',
                'string'   => 'Le champ :attribute doit être une chaîne de caractères.',
                'integer'  => 'Le champ :attribute doit être un nombre entier.',
                'numeric'  => 'Le champ :attribute doit être un nombre.',
                'min'      => 'Le champ :attribute doit être au moins :min.',
                'max'      => [ 'string' => 'Le champ :attribute ne doit pas dépasser :max caractères.', 'file' => 'Le fichier :attribute ne doit pas dépasser :max kilo-octets.' ],
                'digits'   => 'Le champ :attribute doit avoir :digits chiffres.',
                'unique'   => 'La valeur du champ :attribute est déjà utilisée.',
                'exists'   => 'La valeur sélectionnée pour :attribute est invalide.',
                'array'    => 'Le champ :attribute doit être une liste.',
                'file'     => 'Le champ :attribute doit être un fichier valide.',
                'mimes'    => 'Le champ :attribute doit être un fichier de type : :values.',
                'code.unique' => 'Ce code de convention existe déjà.',
                'annee_convention.digits' => 'L\'année doit être composée de 4 chiffres.',
                'id_programme.exists' => 'Le programme sélectionné est invalide.',
                'id_projet.exists' => 'Le projet sélectionné est invalide.',
                'fichiers.*.file' => 'Chaque élément dans :attribute doit être un fichier valide.', // Added for clarity
                'fichiers.*.mimes' => 'Type de fichier invalide. Acceptés: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX.',
                'partner_commitments.required' => 'Les engagements des partenaires sont requis.',
            ]);
            Log::info('Validation principale réussie (store - fichiers optionnels).');
        } catch (ValidationException $e) {
            Log::error('Échec validation principale (store):', ['errors' => $e->errors()]);
            return response()->json(['message' => 'Données invalides.', 'errors' => $e->errors()], 422);
        }

        // --- 3. Detailed Partner Commitment Validation ---
        if (!is_array($partnerCommitmentsInput)) {
             return response()->json(['message' => 'Format invalide pour les engagements partenaires (doit être une liste).'], 422);
        }
        if (empty($partnerCommitmentsInput)) {
             // Should be caught by main validation 'partner_commitments.required'
             Log::warning('Tableau engagements partenaires vide mais requis (store).');
             return response()->json(['message' => 'Au moins un engagement partenaire est requis.'], 422);
        }
        Log::info('Validation détaillée engagements partenaires...');
        foreach ($partnerCommitmentsInput as $index => $commitment) {
            if (!is_array($commitment) || !isset($commitment['Id_Partenaire'], $commitment['Montant_Convenu'], $commitment['is_signatory'])) {
                Log::error("Engagement #".($index + 1)." manque clés.", ['data' => $commitment]);
                return response()->json(['message' => "Données manquantes pour l'engagement #" . ($index + 1) . "."], 422);
            }
            $commitmentValidator = Validator::make($commitment, [
                'Id_Partenaire' => 'required|integer|exists:partenaire,Id',
                'Montant_Convenu' => 'required|numeric|min:0',
                'is_signatory' => 'required|boolean',
                'date_signature' => [ Rule::requiredIf(function () use ($commitment) { return ($commitment['is_signatory'] ?? false) && !empty($commitment['date_signature']); }), 'nullable', 'date_format:Y-m-d' ],
                'details_signature' => ['nullable', 'string'],
            ], [
                'Id_Partenaire.required' => "Partenaire requis (engagement #".($index + 1).").",
                'Id_Partenaire.exists' => "Partenaire invalide (engagement #".($index + 1).").",
                'Montant_Convenu.required' => "Montant requis (engagement #".($index + 1).").",
                'Montant_Convenu.numeric' => "Montant doit être nombre (engagement #".($index + 1).").",
                'Montant_Convenu.min' => "Montant doit être positif (engagement #".($index + 1).").",
                'is_signatory.required' => "Statut signataire requis (engagement #".($index + 1).").",
                'is_signatory.boolean' => "Statut signataire invalide (engagement #".($index + 1).").",
                'date_signature.required_if' => "Date signature requise si signataire (engagement #".($index + 1).").",
                'date_signature.date_format' => "Format date signature invalide (AAAA-MM-JJ) (engagement #".($index + 1).").",
             ]);
            if ($commitmentValidator->fails()) {
                 $partnerIdLog = $commitment['Id_Partenaire'] ?? 'Inconnu';
                 Log::error("Échec validation engagement #".($index + 1).".", ['errors' => $commitmentValidator->errors()]);
                 return response()->json(['message' => "Erreur validation engagement #" . ($index + 1) . ".", 'errors' => $commitmentValidator->errors()], 422);
             }
        }
        Log::info('Validation détaillée engagements partenaires terminée.');

        // --- 4. Prepare for DB - Define Paths ---
        $convention = null;
        $createdDocumentsInfo = [];
        $targetDirRelative = 'uploads/conventions';
        $targetDirAbsolute = public_path($targetDirRelative);

        // --- Start Database Transaction ---
        DB::beginTransaction();
        Log::info('Transaction DB démarrée (store - fichiers optionnels).');

        try {
             // --- Ensure Target Directory Exists and is Writable ---
             if (!File::isDirectory($targetDirAbsolute)) {
                Log::info("Dossier cible '{$targetDirAbsolute}' inexistant, création...");
                 if (!File::makeDirectory($targetDirAbsolute, 0775, true, true)) { throw new \Exception("Impossible créer dossier: {$targetDirAbsolute}"); }
                 Log::info("Dossier cible créé.");
             }
             if (!File::isWritable($targetDirAbsolute)) {
                 Log::error("Dossier cible '{$targetDirAbsolute}' non accessible en écriture.");
                 throw new \Exception("Permissions écriture manquantes pour: {$targetDirAbsolute}");
             }
             Log::debug("Dossier cible '{$targetDirAbsolute}' OK.");

            // --- 5. Create Convention Record ---
            $conventionDataForCreate = Arr::except($validatedData, ['fichiers', 'partner_commitments']);
            $conventionDataForCreate['Id_Programme'] = $validatedData['id_programme'];
            $conventionDataForCreate['id_projet'] = $validatedData['id_projet'] ?? null;
            Log::info('Création enregistrement Convention...', $conventionDataForCreate);
            $convention = Convention::create($conventionDataForCreate);
            Log::info("Convention créée: ID {$convention->id}");

            // --- 6. Handle OPTIONAL File Uploads & Create Document Records ---
            Log::info('Traitement des fichiers uploadés (si présents)...');
            // Check if 'fichiers' key exists and is a non-empty array
            if (!empty($validatedData['fichiers']) && is_array($validatedData['fichiers'])) {
                 Log::info(count($validatedData['fichiers']) . ' fichier(s) à traiter.');
                 foreach ($validatedData['fichiers'] as $index => $file) {
                    // Check each item is a valid uploaded file (could be null if validation allows)
                    if ($file instanceof \Illuminate\Http\UploadedFile && $file->isValid()) {
                        $originalName = $file->getClientOriginalName();
                        $mimeType = $file->getClientMimeType() ?: 'application/octet-stream';
                        $size = $file->getSize();
                        $safeOriginalName = preg_replace('/[^A-Za-z0-9\._-]/', '_', $originalName);
                        $generatedFilename = date('Ymd-His') . '_' . Str::random(5) . '_' . $safeOriginalName;

                        Log::debug("Déplacement fichier '{$originalName}' -> '{$generatedFilename}'");
                        try {
                             $file->move($targetDirAbsolute, $generatedFilename);
                             $storedRelativePath = $targetDirRelative . '/' . $generatedFilename;
                             Log::info("Fichier #{$index} déplacé:", ['path' => $storedRelativePath]);
                             $createdDocumentsInfo[] = ['path' => $storedRelativePath]; // Track for rollback

                            // Create Document record
                            $documentData = [
                               'Id_Doc' => 'convdoc_' . Str::uuid()->toString(),
                               'Intitule' => pathinfo($originalName, PATHINFO_FILENAME),
                               'file_type' => $mimeType,
                               'file_name' => $originalName,
                               'file_path' => $storedRelativePath,
                               'file_size' => $size,
                            ];
                            $document = $convention->documents()->create($documentData);
                            Log::info("Document associé #{$index} créé: ID {$document->Id_Doc}");

                        } catch (\Symfony\Component\HttpFoundation\File\Exception\FileException $e) {
                            Log::error(">>> Échec move() pour fichier '{$originalName}': " . $e->getMessage());
                            throw new \Exception("Échec déplacement fichier '{$originalName}'.");
                        }
                    } else {
                        // Log if an item in the array is not a valid file (e.g., it was null)
                        Log::warning("Élément invalide ou null dans 'fichiers' [{$index}] (store), ignoré.");
                    }
                } // End foreach
            } else {
                 Log::info('Aucun fichier fourni pour cette convention (optionnel).');
            } // End if files exist

            // --- 7. Create ConvPart Records ---
            Log::info('Création enregistrements ConvPart...');
            if (!empty($partnerCommitmentsInput)) {
                foreach ($partnerCommitmentsInput as $commitment) {
                    if (!isset($commitment['Id_Partenaire'], $commitment['Montant_Convenu'], $commitment['is_signatory'])) continue;
                    ConvPart::create([
                        'Id_Convention' => $convention->id,
                        'Id_Partenaire' => $commitment['Id_Partenaire'],
                        'Montant_Convenu' => $commitment['Montant_Convenu'],
                        'is_signatory' => $commitment['is_signatory'],
                        'date_signature' => ($commitment['is_signatory'] && !empty($commitment['date_signature'])) ? $commitment['date_signature'] : null,
                        'details_signature' => ($commitment['is_signatory'] && !empty($commitment['details_signature'])) ? $commitment['details_signature'] : null,
                    ]);
                }
                Log::info(count($partnerCommitmentsInput) . " enregistrement(s) ConvPart créé(s).");
            } else {
                 // Should be caught by validation
                 Log::warning("Aucun engagement partenaire fourni (store), mais requis par validation.");
            }

            // --- 8. Commit Transaction ---
            DB::commit();
            Log::info('Transaction DB validée (store).');

            // --- 9. Return Success Response ---
            $convention->load(['programme', 'projet', 'documents', 'convParts.partenaire']);
            $appBaseUrl = rtrim(config('app.url', 'http://localhost'), '/');
            $responseData = $convention->toArray();
            // Format response data
            $responseData['documents'] = $convention->documents->map(function ($doc) use ($appBaseUrl) {
                 $docArray = $doc->toArray(); $docArray['url'] = $doc->file_path ? "{$appBaseUrl}/" . ltrim($doc->file_path, '/') : null; return $docArray;
             })->all();
            $responseData['partner_commitments'] = $convention->convParts->map(function (ConvPart $convPart) {
                 $signatureDate = $convPart->date_signature ? $convPart->date_signature->format('Y-m-d') : null;
                 return [
                     'Id_Partenaire'     => $convPart->Id_Partenaire,
                     'label'             => optional($convPart->partenaire)->Description ?? "Partenaire ID {$convPart->Id_Partenaire}",
                     'Montant_Convenu'   => $convPart->Montant_Convenu,
                     'is_signatory'      => (bool) $convPart->is_signatory,
                     'date_signature'    => $signatureDate,
                     'details_signature' => $convPart->details_signature,
                 ];
            })->values()->all();

            return response()->json([ "success" => "Convention ajoutée!", "message" => "Convention ajoutée!", "convention" => $responseData ], 201);

        // --- Catch Blocks ---
        } catch (\Illuminate\Database\QueryException $qe) {
            DB::rollBack(); Log::error('ERREUR DB (store):', ['message' => $qe->getMessage(), 'sql' => $qe->getSql(), 'bindings' => $qe->getBindings()]);
            foreach($createdDocumentsInfo as $docInfo) { // Cleanup files
                 $absolutePath = public_path($docInfo['path']); if (!empty($docInfo['path']) && File::exists($absolutePath)) { try { File::delete($absolutePath); Log::warning("Fichier déplacé annulé (rollback DB): {$absolutePath}"); } catch (\Exception $ex) { Log::error("Échec suppression fichier {$absolutePath} (rollback DB): " . $ex->getMessage()); } }
             }
            return response()->json(["message" => "Erreur DB lors création."], 500);
        } catch (\Exception $e) {
            DB::rollBack(); Log::error('ERREUR GÉNÉRALE (store):', ['message' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
             foreach($createdDocumentsInfo as $docInfo) { // Cleanup files
                 $absolutePath = public_path($docInfo['path']); if (!empty($docInfo['path']) && File::exists($absolutePath)) { try { File::delete($absolutePath); Log::warning("Fichier déplacé annulé (rollback Erreur): {$absolutePath}"); } catch (\Exception $ex) { Log::error("Échec suppression fichier {$absolutePath} (rollback Erreur): " . $ex->getMessage()); } }
             }
            $statusCode = ($e instanceof ValidationException) ? 422 : 500;
             return response()->json(["message" => "Échec création.", "error_details" => $e->getMessage(), "errors" => $e instanceof ValidationException ? $e->errors() : null ], $statusCode);
        }
    }

     /**
      * Display the specified convention.
      * GET /api/conventions/{id}
      */
      public function show(Convention $convention): JsonResponse
    {
        $conventionId = $convention->id; // Get ID for logging
        Log::info("API: Requête pour détails Convention ID: {$conventionId}");

        try {
            // Eager load relationships onto the already resolved $convention instance
            $convention->load([
                // Load standard relations defined in Convention model
                'documents',     // Assuming 'documents' relationship exists and is needed
                'programme',     // Assuming 'programme' relationship exists and is needed
                'projet',        // Assuming 'projet' relationship exists and is needed
                'avenants',      // Assuming 'avenants' relationship exists and might be needed

                // Load partner commitments ('convParts') and their related data efficiently
                'convParts' => function ($query) {
                    $query
                        // 1. Eager load the 'partenaire' relation FOR EACH commitment
                        //    Select only necessary columns for efficiency
                        //    (Assumes 'partenaire' relationship exists in ConvPart model)
                        ->with('partenaire:Id,Description,Description_Arr')

                        // 2. Calculate the sum of 'montant_verse' from related 'versements'
                        //    (Assumes 'versements' relationship exists in ConvPart model)
                        //    The result is attached as 'Montant_Verse' (aliased) to each 'ConvPart' object.
                        ->withSum('versements as Montant_Verse', 'montant_verse');
                }
            ]);

            // --- Data Transformation for Frontend Consistency ---
            // Convert the fully loaded model and its relations to an array
            $responseData = $convention->toArray();

            // Map the 'conv_parts' data (snake_case key from toArray)
            // to 'partner_commitments' (frontend expected key)
            if (isset($responseData['conv_parts']) && is_array($responseData['conv_parts'])) {
                $responseData['partner_commitments'] = array_map(function ($commitment) {
                    // Prepare a structured array for each commitment
                    $commitmentData = [];

                    // 1. Create 'label' from nested partner description
                    if($commitment['partenaire']['Description_Arr']){
                        $commitmentData['label'] = $commitment['partenaire']['Description_Arr'] ;

                    }
                    else{
                        $commitmentData['label'] = $commitment['partenaire']['Description'] ;

                    }
                    // 2. Add the calculated sum (using the alias 'Montant_Verse')
                    //    Default to 0.00 if somehow null (withSum usually returns 0 or a number string)
                    $commitmentData['Montant_Verse'] = $commitment['Montant_Verse'] ?? '0.00';

                    // 3. Map other fields directly from the ConvPart model/data
                    $commitmentData['Montant_Convenu'] = $commitment['Montant_Convenu'] ?? null;

                    // --- vvv THIS LINE IS NOW CORRECTED vvv ---
                    $commitmentData['is_signatory'] = (bool)($commitment['is_signatory'] ?? false); // Use the correct field name 'is_signatory'
                    // --- ^^^ THIS LINE IS NOW CORRECTED ^^^ ---

                    $commitmentData['Id_Partenaire'] = $commitment['Id_Partenaire'] ?? null;
                    $commitmentData['date_signature'] = $commitment['date_signature'] ?? null; // Already cast to Y-m-d string by model
                    $commitmentData['details_signature'] = $commitment['details_signature'] ?? null;
                    $commitmentData['Id_CP'] = $commitment['Id_CP'] ?? null; // The commitment's own primary key

                    return $commitmentData;

                }, $responseData['conv_parts']);

                // Remove the original snake_case key after transformation
                unset($responseData['conv_parts']);
            } else {
                 // Ensure the key exists as an empty array if there are no commitments
                 $responseData['partner_commitments'] = [];
            }

            // Ensure other necessary top-level fields are present as expected
            // $responseData['projet'] = $responseData['projet'] ?? null;
            // $responseData['programme'] = $responseData['programme'] ?? null;
            // $responseData['documents'] = $responseData['documents'] ?? [];

            // --- Final Response ---
            // Wrap the transformed data under the 'convention' key
            Log::info("API: Succès récupération détails Convention ID: {$conventionId}");
            return response()->json(['convention' => $responseData], 200);

        } catch (\Exception $e) {
             Log::warning("API: Convention ID {$conventionId} non trouvée.", ['error' => $e->getMessage()]);
             return response()->json(['message' => 'Convention non trouvée.'], 404);
        } catch (\Exception $e) {
            Log::error("API: Erreur récupération détaillée Convention ID {$conventionId}:", [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString() // Be cautious logging full traces in production environments
            ]);
            return response()->json(['message' => 'Erreur serveur lors de la récupération des détails de la convention.'], 500);
        }
    }

    /**
     * Update the specified convention.
     * POST /api/conventions/{id} (with _method=PUT)
     */
    public function update(Request $request, string $id): JsonResponse // Use string for ID consistency
    {
        Log::info("Requête MAJ reçue pour Convention ID {$id}...");
        Log::debug('Données brutes MAJ (convention):', $request->all());

        // --- Find Existing Convention First ---
        try {
            $convention = Convention::findOrFail($id);
        } catch (ModelNotFoundException $e) {
            Log::error("Convention non trouvée pour MAJ. ID: {$id}");
            return response()->json(['message' => 'Convention non trouvée.'], 404);
        }

        // --- Decode Inputs ---
        $partnerCommitmentsInput = json_decode($request->input('partner_commitments', '[]'), true);
        if (json_last_error() !== JSON_ERROR_NONE) { Log::error('Échec décodage JSON engagements (update).'); return response()->json(['message' => 'Format JSON engagements invalide.'], 400); }

        $documentIdsToDeleteInput = json_decode($request->input('deleted_document_ids', '[]'), true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($documentIdsToDeleteInput)) { Log::error('Échec décodage JSON IDs suppression (update).'); return response()->json(['message' => 'Format JSON IDs suppression invalide.'], 400); }

        // --- Validation Rules ---
        $validationRules = [
            // Convention fields (ensure unique 'code' ignores current convention)
            'code' => ['required','integer', Rule::unique('convention', 'code')->ignore($convention->id)],
            'classification_prov' => 'required|string',
            'categorie' => 'required|string',
            'intitule' => 'required|string',
            'reference' => 'required|string',
            'annee_convention' => 'required|integer|digits:4',
            'observations' => 'nullable|string|max:20000',
            'objet' => 'required|string',
            'objectifs' => 'required|string',
            'localisation' => 'required|string', // String of province IDs separated by ';'
            'maitre_ouvrage' => 'required|string',
            'partenaire' => 'nullable|string',
            'cout_global' => 'required|numeric|min:0',
            'cout_cr' => 'required|numeric|min:0',
            'statut' => 'required|string',
            'operationalisation' => 'required|string',
            'id_programme' => 'required|integer|exists:programme,Id',
            'id_projet' => 'nullable|integer|exists:projet,ID_Projet',
            'groupe' => 'required|integer',
            'rang' => 'nullable|string',

            // Files & Commitments
            'fichiers' => 'nullable|array',
            'fichiers.*' => 'nullable|file|mimes:pdf,doc,docx,jpg,jpeg,png,xls,xlsx|max:5120', // Max 5MB example
            'partner_commitments' => ['required', 'string'], // Keep as string for initial validation
            'deleted_document_ids' => 'nullable|string', // Keep as string for initial validation

            // Confirmation flag (optional, boolean if present)
            'confirm_delete_commitments' => 'sometimes|boolean', // <<< ADDED CONFIRMATION FLAG
        ];

        $validationMessages = [ // Add specific messages as needed
             'required' => 'Le champ :attribute est obligatoire.',
             'integer' => 'Le champ :attribute doit être un nombre entier.',
             'numeric' => 'Le champ :attribute doit être un nombre.',
             'string' => 'Le champ :attribute doit être une chaîne de caractères.',
             'exists' => 'La valeur sélectionnée pour :attribute est invalide.',
             'unique' => 'Ce code de convention est déjà utilisé.',
             'min' => 'Le champ :attribute doit être au moins :min.',
             'max' => [ 'string' => 'Le champ :attribute ne doit pas dépasser :max caractères.', 'file' => 'Le fichier :attribute ne doit pas dépasser :max kilo-octets (5Mo).' ],
             'digits' => 'Le champ :attribute doit avoir :digits chiffres.',
             'array' => 'Le champ :attribute doit être une liste.',
             'file' => 'Le champ :attribute doit être un fichier valide.',
             'mimes' => 'Type de fichier invalide. Acceptés: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX.',
             'id_programme.exists' => 'Le programme sélectionné est invalide.',
             'id_projet.exists' => 'Le projet sélectionné est invalide.',
             'partner_commitments.required' => 'Les engagements des partenaires sont requis.',
             'confirm_delete_commitments.boolean' => 'La confirmation doit être vraie ou fausse.',
             'observations.max' => 'Les observations ne doivent pas dépasser :max caractères.',
         ];

        // --- Perform Validation ---
        $validator = Validator::make($request->all(), $validationRules, $validationMessages);
        if ($validator->fails()) {
            Log::error('Échec validation principale (Convention update):', ['errors' => $validator->errors()]);
            return response()->json(['message' => 'Données invalides.', 'errors' => $validator->errors()], 422);
        }
        $validatedData = $validator->validated();
        $confirmDeleteCommitments = $validatedData['confirm_delete_commitments'] ?? false; // Get confirmation flag


        // --- Detailed Partner Commitment Validation ---
        if (!is_array($partnerCommitmentsInput)) { return response()->json(['message' => 'Format invalide pour les engagements partenaires (doit être une liste).'], 422); }
        // REMOVED check for empty array - allow removing all partners
        // if (empty($partnerCommitmentsInput)) { return response()->json(['message' => 'Au moins un engagement partenaire est requis.'], 422); }

        Log::info('Validation détaillée engagements partenaires (update)...');
        foreach ($partnerCommitmentsInput as $index => $commitment) {
            // Validate structure and types
            if (!is_array($commitment)) { return response()->json(['message' => "Format invalide pour l'engagement #".($index+1)."."], 422); }

            $commitmentValidator = Validator::make($commitment, [
                // <<< ADDED: Validate optional Id_CP for existing commitments >>>
                'id_cp' => ['sometimes', 'required', 'integer', Rule::exists('convention_partenaire', 'Id_CP')], // Expect 'id_cp' from frontend
                'Id_Partenaire' => 'required|integer|exists:partenaire,Id',
                'Montant_Convenu' => 'required|numeric|min:0',
                'is_signatory' => 'required|boolean',
                'date_signature' => [ Rule::requiredIf(function () use ($commitment) { return ($commitment['is_signatory'] ?? false); }), 'nullable', 'date_format:Y-m-d' ],
                'details_signature' => ['nullable', 'string', 'max:1000'],
            ], [ // Add specific messages
                'id_cp.required' => "L'identifiant interne (ID CP) est manquant pour un engagement existant.",
                'id_cp.integer' => "L'identifiant interne (ID CP) doit être un nombre.",
                'id_cp.exists' => "L'engagement partenaire avec l'ID CP fourni n'existe pas ou n'appartient pas à cette convention.", // Refine check later if needed
                'Id_Partenaire.required' => "Partenaire requis (engagement #".($index + 1).").",
                'Id_Partenaire.exists' => "Partenaire invalide (engagement #".($index + 1).").",
                'Montant_Convenu.*' => "Montant invalide (engagement #".($index + 1).").", // Simplified message
                'is_signatory.*' => "Statut signataire invalide (engagement #".($index + 1).").",
                'date_signature.required_if' => "Date signature requise si signataire (engagement #".($index + 1).").",
                'date_signature.date_format' => "Format date signature invalide (AAAA-MM-JJ) (engagement #".($index + 1).").",
            ]);

            if ($commitmentValidator->fails()) {
                 Log::error("Update: Échec validation engagement #".($index + 1).".", ['errors' => $commitmentValidator->errors()]);
                 return response()->json(['message' => "Erreur validation engagement #" . ($index + 1) . ".", 'errors' => $commitmentValidator->errors()], 422);
            }
        }
        Log::info('Validation détaillée engagements partenaires (update) OK.');


        // --- Document ID Validation ---
        if (!empty($documentIdsToDeleteInput)) {
            $validDocIds = Document::where('Id_Conv', $convention->id)->whereIn('Id_Doc', $documentIdsToDeleteInput)->pluck('Id_Doc')->all();
            if (count($validDocIds) !== count(array_unique($documentIdsToDeleteInput))) { // Check unique count
                $invalidIds = array_diff($documentIdsToDeleteInput, $validDocIds);
                Log::error('IDs docs invalides pour suppression (update).', ['invalid_ids' => $invalidIds]);
                return response()->json(['message' => 'Suppression docs invalides.', 'errors' => ['deleted_document_ids' => ['IDs invalides fournis.']]], 422);
            }
            Log::info('Tous les IDs de documents à supprimer sont valides.');
        }


        // --- Prepare Data & Paths ---
        $conventionUpdateData = Arr::except($validatedData, ['fichiers', 'deleted_document_ids', 'partner_commitments', 'confirm_delete_commitments']);
        // Ensure foreign keys are present
        $conventionUpdateData['Id_Programme'] = $validatedData['id_programme'];
        $conventionUpdateData['id_projet'] = $validatedData['id_projet'] ?? null;
        // Ensure localisation is handled (assuming it's already a string like "1;2;3")
        $conventionUpdateData['localisation'] = $validatedData['localisation'];

        $filesToDeletePhysicallyAbsolute = [];
        $newlyAddedDocumentInfo = [];
        $targetDirRelative = 'uploads/conventions';
        $targetDirAbsolute = public_path($targetDirRelative);

        // --- Start DB Transaction ---
        DB::beginTransaction();
        Log::info("Transaction DB démarrée (Convention update ID: {$id}). Confirmation fournie: " . ($confirmDeleteCommitments ? 'Oui' : 'Non'));

        try {
            // --- File/Directory Checks ---
            if (!File::isDirectory($targetDirAbsolute)) { if (!File::makeDirectory($targetDirAbsolute, 0775, true, true)) { throw new \Exception("Impossible créer dossier: {$targetDirAbsolute}"); } }
            if (!File::isWritable($targetDirAbsolute)) { throw new \Exception("Permissions écriture manquantes pour: {$targetDirAbsolute}"); }

            // --- Process Document Deletions ---
            if (!empty($documentIdsToDeleteInput)) {
                Log::info("Traitement suppression DB Documents:", $documentIdsToDeleteInput);
                $docsToDelete = Document::whereIn('Id_Doc', $documentIdsToDeleteInput)->where('Id_Conv', $convention->id)->get(['Id_Doc', 'file_path']); // Ensure they belong to this convention
                foreach($docsToDelete as $doc) { if($doc->file_path) { $filesToDeletePhysicallyAbsolute[] = public_path($doc->file_path); } }
                $deletedDbCount = Document::destroy($docsToDelete->pluck('Id_Doc')->all()); // Use the fetched IDs
                Log::info("Supprimé {$deletedDbCount} enregistrement(s) Document DB.");
            }

            // --- Process NEW File Uploads ---
            if (!empty($validatedData['fichiers']) && is_array($validatedData['fichiers'])) {
                Log::info('Traitement nouveaux fichiers (update)...');
                foreach ($validatedData['fichiers'] as $index => $file) {
                    // ... (file handling logic remains the same as your original store/update) ...
                     if ($file instanceof \Illuminate\Http\UploadedFile && $file->isValid()) {
                         $originalName = $file->getClientOriginalName();
                         $mimeType = $file->getClientMimeType() ?: 'application/octet-stream'; $size = $file->getSize();
                         $safeOriginalName = preg_replace('/[^A-Za-z0-9\._-]/', '_', $originalName);
                         $generatedFilename = date('Ymd-His') . '_' . Str::random(5) . '_' . $safeOriginalName;
                         try {
                            $file->move($targetDirAbsolute, $generatedFilename);
                            $storedRelativePath = $targetDirRelative . '/' . $generatedFilename;
                            $newlyAddedDocumentInfo[] = ['relative' => $storedRelativePath, 'absolute' => public_path($storedRelativePath)];
                            $documentData = [ 'Id_Doc' => 'convdoc_' . Str::uuid()->toString(), 'Intitule' => pathinfo($originalName, PATHINFO_FILENAME), 'file_type' => $mimeType, 'file_name' => $originalName, 'file_path' => $storedRelativePath, 'file_size' => $size ];
                            $newDocument = $convention->documents()->create($documentData);
                            Log::info("Nouveau Document ajouté #{$index}: ID {$newDocument->Id_Doc}");
                         } catch (\Symfony\Component\HttpFoundation\File\Exception\FileException $e) { Log::error(">>> Échec move() nouveau fichier '{$originalName}' (update): " . $e->getMessage()); throw new \Exception("Échec critique déplacement fichier '{$originalName}'."); }
                     } else { Log::warning("Nouveau fichier invalide/null #{$index} (update), ignoré."); }
                }
            } else { Log::info('Aucun nouveau fichier (update).'); }


            // --- Update Convention Record ---
            Log::info('MAJ enregistrement Convention...');
            $convention->update($conventionUpdateData);
            Log::info("Convention MAJ: ID {$convention->id}");


            // --- >>> START: Smart Sync Partner Commitments (ConvPart) <<< ---
            Log::info("Synchronisation engagements partenaires (ConvPart) pour Convention ID: {$id}");

            $existingConvPartIds = $convention->convParts()->pluck('Id_CP')->toArray(); // Get current DB IDs
            $submittedCommitmentsData = collect($partnerCommitmentsInput); // Use the decoded input
            $submittedConvPartIds = $submittedCommitmentsData->pluck('id_cp')->filter()->unique()->toArray(); // Get IDs submitted (use 'id_cp' from frontend)

            $convPartIdsToDelete = array_diff($existingConvPartIds, $submittedConvPartIds); // Existing IDs not submitted = Delete

            // --- Handle Deletions ---
            if (!empty($convPartIdsToDelete)) {
                Log::info("ConvPart IDs potentiels à supprimer: " . implode(', ', $convPartIdsToDelete));

                $versementsExistForDeleted = false;
                // Check for associated versements ONLY IF cascade confirmation is NOT provided
                if (!$confirmDeleteCommitments) {
                    $versementsExistForDeleted = VersementCP::whereIn('id_CP', $convPartIdsToDelete)->exists(); // Check VersementCP table
                    Log::info("Vérification versements pour IDs ConvPart à supprimer (sans confirmation). Trouvé: " . ($versementsExistForDeleted ? 'Oui' : 'Non'));
                }

                if ($versementsExistForDeleted) {
                    // CONFLICT DETECTED
                    DB::rollBack(); // Rollback transaction
                    Log::warning("MAJ Convention annulée (ID: {$id}): Confirmation requise pour supprimer engagements avec versements.");

                    // Fetch details for the frontend modal
                    $conflictingCommitments = ConvPart::whereIn('Id_CP', $convPartIdsToDelete)
                                                ->with('partenaire:Id,Description') // Load partner name
                                                ->get(['Id_CP', 'Id_Partenaire']);

                     $details = $conflictingCommitments->map(function ($cp) {
                         $partnerName = $cp->partenaire->Description ?? 'Partenaire ID '.$cp->Id_Partenaire;
                         return "Engagement avec {$partnerName} (ID Engagement: {$cp->Id_CP})";
                     })->toArray();

                    // Return 409 Conflict
                    return response()->json([
                        'message' => 'Confirmation requise : La suppression de certains engagements entraînera la suppression définitive de leurs versements associés.',
                        'requires_confirmation' => true, // Flag for frontend
                        'details' => $details
                    ], 409); // HTTP 409 Conflict
                } else {
                    // OK TO DELETE
                    Log::info("Poursuite suppression ConvPart IDs: " . implode(', ', $convPartIdsToDelete) . ". Confirmation: " . ($confirmDeleteCommitments ? 'fournie' : 'non requise'));
                    // Perform the delete. Versements might cascade delete depending on DB constraints.
                    $deletedCount = ConvPart::whereIn('Id_CP', $convPartIdsToDelete)->delete();
                    Log::info("Supprimé {$deletedCount} enregistrements ConvPart.");
                }
            } else {
                 Log::info("Aucun enregistrement ConvPart marqué pour suppression.");
            }

            // --- Handle Updates and Creates ---
            Log::info("Traitement MAJ/Création pour " . $submittedCommitmentsData->count() . " engagements soumis.");
            foreach ($submittedCommitmentsData as $commitmentData) {
                $dataToSync = [
                    // Fields to update or create with
                    'Montant_Convenu'   => $commitmentData['Montant_Convenu'],
                    'is_signatory'      => $commitmentData['is_signatory'],
                    'date_signature'    => ($commitmentData['is_signatory'] && !empty($commitmentData['date_signature'])) ? $commitmentData['date_signature'] : null,
                    'details_signature' => ($commitmentData['is_signatory'] && !empty($commitmentData['details_signature'])) ? $commitmentData['details_signature'] : null,
                    // Include 'avenant_id' if it's part of the commitment data and needs syncing
                    // 'avenant_id' => $commitmentData['avenant_id'] ?? null,
                ];

                // Use updateOrCreate:
                // 1st array: Attributes to find the record by (Convention + Partner)
                // 2nd array: Attributes to update the found record with, or create a new record with if not found
                $convPart = ConvPart::updateOrCreate(
                    [
                        'Id_Convention' => $convention->id,
                        'Id_Partenaire' => $commitmentData['Id_Partenaire'], // Partner ID is always required
                    ],
                    $dataToSync // The values to set/update
                );
                 Log::debug("Synchronisé ConvPart ID: {$convPart->Id_CP} pour Partenaire ID: {$commitmentData['Id_Partenaire']}. Était existant: " . $convPart->wasRecentlyCreated ? 'Non' : 'Oui');
            }
            Log::info("Synchronisation ConvPart terminée.");

            // --- <<< END: Smart Sync Partner Commitments >>> ---


            // --- Commit Transaction ---
            DB::commit();
            Log::info('Transaction DB validée (Convention update).');

            // --- Delete OLD physical files ---
            if (!empty($filesToDeletePhysicallyAbsolute)) {
                // ... (physical file deletion logic remains the same) ...
                Log::info("Tentative suppression " . count($filesToDeletePhysicallyAbsolute) . " ancien(s) fichier(s)...");
                foreach($filesToDeletePhysicallyAbsolute as $absolutePath) {
                     try {
                         if ($absolutePath && File::exists($absolutePath)) {
                             if(File::delete($absolutePath)) { Log::info("Ancien fichier physique supprimé: {$absolutePath}"); }
                             else { Log::error("File::delete a échoué pour: {$absolutePath}"); }
                         } else { Log::warning("Chemin fichier physique non trouvé pour suppression: '{$absolutePath}'"); }
                     } catch (\Exception $fsEx) { Log::error("Erreur suppression fichier physique: {$absolutePath}", ['exception' => $fsEx]); }
                 }
            }

            // --- Return Success Response ---
            // Reload relationships to get the *current* state after sync
            $updatedConvention = $convention->fresh()->load([
                'programme', 'projet', 'documents',
                'convParts' => function ($q) { $q->with('partenaire:Id,Description,Description_Arr')->withSum('versements as Montant_Verse', 'montant_verse'); } // Reload synced data
            ]);
            $appBaseUrl = rtrim(config('app.url', 'http://localhost'), '/');
            $updatedConventionData = $updatedConvention->toArray();

            // Format response data (same transformation as in show method)
            $updatedConventionData['documents'] = $updatedConvention->documents->map(function ($doc) use ($appBaseUrl) { $docArray = $doc->toArray(); $docArray['url'] = $doc->file_path ? "{$appBaseUrl}/" . ltrim($doc->file_path, '/') : null; return $docArray; })->all();
             // Map 'conv_parts' to 'partner_commitments' for frontend
            if (isset($updatedConventionData['conv_parts']) && is_array($updatedConventionData['conv_parts'])) {
                $updatedConventionData['partner_commitments'] = array_map(function ($commitment) {
                     $commitmentData = [];
                     $commitmentData['label'] = $commitment['partenaire']['Description'] ?? ($commitment['partenaire']['Description_Arr'] ?? 'Partenaire inconnu');
                     if($commitment['partenaire']['Code'] ?? null) { $commitmentData['label'] = $commitment['partenaire']['Code'] . ' - ' . $commitmentData['label']; }
                     $commitmentData['Montant_Verse'] = $commitment['Montant_Verse'] ?? '0.00';
                     $commitmentData['Montant_Convenu'] = $commitment['Montant_Convenu'] ?? null;
                     $commitmentData['is_signatory'] = (bool)($commitment['is_signatory'] ?? false);
                     $commitmentData['Id_Partenaire'] = $commitment['Id_Partenaire'] ?? null;
                     $commitmentData['date_signature'] = $commitment['date_signature'] ?? null;
                     $commitmentData['details_signature'] = $commitment['details_signature'] ?? null;
                     $commitmentData['Id_CP'] = $commitment['Id_CP'] ?? null; // <<< Include Id_CP in response
                     return $commitmentData;
                 }, $updatedConventionData['conv_parts']);
                 unset($updatedConventionData['conv_parts']);
             } else { $updatedConventionData['partner_commitments'] = []; }

            return response()->json(['success' => 'Convention Modifiée!', 'message' => 'Convention Modifiée!', 'convention' => $updatedConventionData], 200);

        // --- Catch Blocks ---
        } catch (\Illuminate\Database\QueryException $qe) {
            DB::rollBack(); Log::error('ERREUR DB (Convention update):', ['id' => $id, 'message' => $qe->getMessage(), 'sql' => $qe->getSql()]);
            // Cleanup newly added files on DB error
            foreach($newlyAddedDocumentInfo as $docInfo) { $absolutePath = $docInfo['absolute']; if (!empty($absolutePath) && File::exists($absolutePath)) { try { File::delete($absolutePath); Log::warning("Fichier ajouté annulé (rollback DB MAJ Conv): {$absolutePath}"); } catch (\Exception $ex) { Log::error("Échec suppression fichier {$absolutePath} (rollback DB MAJ Conv): " . $ex->getMessage()); } } }
            // Check for specific constraint violations if needed
             if (str_contains($qe->getMessage(), '1451')) { // Foreign key constraint
                  return response()->json(['message' => 'Erreur de base de données : Impossible de mettre à jour en raison de contraintes de clé étrangère.'], 500);
             }
             return response()->json(["message" => "Erreur Base de Données lors modification."], 500);
         }
        catch (\Exception $e) {
            DB::rollBack(); Log::error('ERREUR GÉNÉRALE (Convention update):', ['id' => $id, 'message' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            // Cleanup newly added files on general error
             foreach($newlyAddedDocumentInfo as $docInfo) { $absolutePath = $docInfo['absolute']; if (!empty($absolutePath) && File::exists($absolutePath)) { try { File::delete($absolutePath); Log::warning("Fichier ajouté annulé (rollback Erreur MAJ Conv): {$absolutePath}"); } catch (\Exception $ex) { Log::error("Échec suppression fichier {$absolutePath} (rollback Erreur MAJ Conv): " . $ex->getMessage()); } } }

            $statusCode = ($e instanceof ValidationException) ? 422 : 500; // Already handled validation exceptions above, but keep for safety
             return response()->json(['message' => 'Échec modification.', "error_details" => $e->getMessage() ], $statusCode);
         }
    }


    // ... destroy method remains the same ...
     public function destroy(string $id)
    {
        Log::info("Tentative suppression ID: {$id}...");
        $conventionToDelete = Convention::with(['documents', 'convParts'])->find($id);
        if (!$conventionToDelete) { Log::error("Convention ID: {$id} non trouvée."); return response()->json(['message' => 'Convention non trouvée.'], 404); }

        $filesToDeletePhysicallyAbsolute = [];
        foreach($conventionToDelete->documents as $doc) {
             if($doc->file_path) { $absolutePath = public_path($doc->file_path); if (File::exists($absolutePath)) { $filesToDeletePhysicallyAbsolute[] = $absolutePath; } else { Log::warning("Chemin fichier non trouvé (destroy): '{$absolutePath}'"); } }
        }
        Log::info("Collecté " . count($filesToDeletePhysicallyAbsolute) . " fichiers à supprimer.");

        DB::beginTransaction(); Log::info("Transaction DB (destroy) ID: {$id}");
        try {
            // You might need to check for versements before deleting convParts here too,
            // depending on your database constraints (ON DELETE CASCADE vs RESTRICT)
             $conventionToDelete->convParts()->delete(); Log::info("ConvParts supprimés.");

            $conventionToDelete->documents()->delete(); Log::info("Documents supprimés.");
            $conventionToDelete->delete(); Log::info("Convention supprimée.");
            DB::commit(); Log::info("Transaction DB validée (destroy).");

            // Delete physical files AFTER commit
            if (!empty($filesToDeletePhysicallyAbsolute)) {
                // ... (physical file deletion logic) ...
                 Log::info("Tentative suppression " . count($filesToDeletePhysicallyAbsolute) . " fichier(s) physique(s)...");
                 foreach ($filesToDeletePhysicallyAbsolute as $absolutePath) {
                     try {
                         if (File::exists($absolutePath)) {
                             if(File::delete($absolutePath)) { Log::info("Fichier physique supprimé: {$absolutePath}"); }
                             else { Log::error("File::delete a échoué pour: {$absolutePath}"); }
                         } else { Log::warning("Chemin fichier physique non trouvé au moment suppression: '{$absolutePath}'"); }
                     } catch (\Exception $storageEx) { Log::error("Erreur suppression fichier physique: {$absolutePath}", ['exception' => $storageEx]); }
                 }
             } else { Log::info("Aucun fichier physique à supprimer."); }


            return response()->json(['success' => 'Convention Supprimée!', 'message' => 'Suppression réussie.'], 200);

        } catch (\Illuminate\Database\QueryException $qe) { // Catch DB errors specifically
             DB::rollBack();
             Log::error('Erreur DB durant la suppression (Convention):', ['id' => $id, 'message' => $qe->getMessage()]);
             if (str_contains($qe->getMessage(), '1451')) { // Foreign key constraint
                 return response()->json(['message' => 'Impossible de supprimer cette convention car elle est référencée ailleurs (projets, etc.).'], 409); // 409 Conflict
             }
             return response()->json(['message' => 'Erreur Base de Données lors de la suppression.'], 500);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erreur durant la suppression (Convention):', ['id' => $id, 'message' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erreur lors de la suppression.', 'error_details' => $e->getMessage()], 500);
        }
    }


    /**
     * Remove the specified convention.
     * DELETE /api/conventions/{id}
     */
  
} // End of Controller Class