<?php

namespace App\Http\Controllers;

// Required Model imports
use App\Models\Projet;
use App\Models\Domaine;
use App\Models\Programme;
use App\Models\Chantier;
use App\Models\Convention;
use App\Models\EngagementFinancier; // <-- Added
use App\Models\Versement;
use App\Models\Partenaire;          // <-- Added

// Required Facades and Classes
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;       // <-- Added for transactions
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Validator; // <-- Added for detailed validation if needed

class ProjetController extends Controller
{
    /**
     * Display a listing of the resource.
     * Eager loads relationships including engagements.
     */
    public function index(): JsonResponse
    {
        try {
            $projets = Projet::with([
                    'domaine',
                    'programme',
                    'chantier',
                    'convention',
                    'engagementsFinanciers.partenaire' // <-- Added eager loading
                ])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json(['projets' => $projets], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching projets: ' . $e->getMessage());
            return response()->json(['message' => 'Erreur lors de la récupération des projets'], 500); // Use 'message' key for consistency
        }
    }

    /**
     * Display the specified resource.
     * Eager loads relationships including engagements.
     */
    public function show(string $id): JsonResponse // $id here is ID_Projet
    {
        try {
            // Find using 'ID_Projet' column or fail
            $projet = Projet::where('ID_Projet', $id)
                ->with([
                    'domaine',
                    'programme',
                    'chantier',
                    'convention',
                    'engagementsFinanciers' => function ($query) {
                    $query->with(['partenaire', 'versements']);} // <-- Added eager loading
                ])
                ->firstOrFail(); // Use firstOrFail for automatic 404
                Log::debug("Data being sent from show method for Projet ID {$id}: ", $projet->toArray());
                  Log::debug("--- Inspecting Engagements Before Response (Projet ID: {$id}) ---");
        if ($projet->relationLoaded('engagementsFinanciers')) {
            foreach ($projet->engagementsFinanciers as $index => $engagement) {
                Log::debug("Engagement #{$index} Raw Attributes:", $engagement->getAttributes()); // Get raw attributes before casts
                Log::debug("Engagement #{$index} Casted Date:", ['date_engagement' => $engagement->date_engagement]); // Access casted property
                Log::debug("Engagement #{$index} Casted Comment:", ['commentaire' => $engagement->commentaire]); // Access comment property
            }
        } else {
            Log::debug("Engagements relation not loaded.");
        }
            return response()->json(['projet' => $projet], 200);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
             Log::warning("Projet not found with ID_Projet: {$id}");
             return response()->json(['message' => 'Projet non trouvé.'], 404);
        } catch (\Exception $e) {
            Log::error('Error fetching projet ID_Projet ' . $id . ': ' . $e->getMessage());
            // Consistent error response
            return response()->json(['message' => 'Erreur serveur lors de la récupération du projet.'], 500);
        }
    }

    /**
     * Store a newly created resource in storage, including engagements.
     */
    public function store(Request $request): JsonResponse
    {
        // --- Validation Rules ---
        $validationRules = [
            // Projet Fields
            'Code_Projet' => 'required|integer|unique:projet,Code_Projet',
            'Nom_Projet' => 'required|string|max:65535',
            'Id_Domaine' => ['required', 'integer', Rule::exists('domaine', 'Code')],
            'Id_Programme' => ['required', 'integer', Rule::exists('programme', 'Code_Programme')],
            'Id_Chantier' => ['required', 'integer', Rule::exists('chantier', 'Code_Chantier')],
            'Convention_Code' => ['nullable', 'integer', Rule::exists('convention', 'Code')],
            'Cout_CRO' => 'nullable|numeric|min:0',
            'Date_Debut' => 'nullable|date_format:Y-m-d',
            'Observations' => 'nullable|string',
            'Etat_Avan_Physi' => 'nullable|numeric|min:0|max:100',
            'Date_Fin' => 'nullable|date_format:Y-m-d|after_or_equal:Date_Debut',
            'Cout_Projet' => 'nullable|numeric|min:0',

            // Engagements Fields (adjust required/nullable as needed)
            'engagements' => 'present|array', // Must be present, can be empty if allowed
            'engagements.*.partenaire_id' => 'required|integer|exists:partenaire,id', // Validate against partenaire PK
            'engagements.*.montant_engage' => 'required|numeric|min:0',
            'engagements.*.date_engagement' => 'required|date_format:Y-m-d',
            'engagements.*.est_formalise' => 'required|boolean',
            'engagements.*.commentaire' => 'nullable|string|max:65535', // Max length for TEXT
        ];

        $validationMessages = [
            'required' => 'Le champ :attribute est obligatoire.',
            'string' => 'Le champ :attribute doit être une chaîne.',
            'numeric' => 'Le champ :attribute doit être un nombre.',
            'boolean' => 'Le champ :attribute doit être vrai ou faux.',
            'date_format' => 'Le champ :attribute doit être au format AAAA-MM-JJ.',
            'unique' => 'La valeur du champ :attribute est déjà utilisée.',
            'exists' => 'La valeur sélectionnée pour :attribute est invalide.',
            'array' => 'Le champ :attribute doit être une liste.',
            'min' => 'Le champ :attribute doit être au moins :min.',
            'max' => 'Le champ :attribute ne doit pas dépasser :max.',
            'after_or_equal' => 'La :attribute doit être une date postérieure ou égale à la date de début.',
            'engagements.present' => 'La liste des engagements doit être fournie.',
            'engagements.*.partenaire_id.required' => 'Le partenaire est requis pour chaque engagement.',
            'engagements.*.partenaire_id.exists' => 'Le partenaire sélectionné pour un engagement est invalide.',
            'engagements.*.montant_engage.required' => 'Le montant est requis pour chaque engagement.',
            'engagements.*.montant_engage.numeric' => 'Le montant doit être numérique pour chaque engagement.',
            'engagements.*.date_engagement.required' => 'La date est requise pour chaque engagement.',
            'engagements.*.date_engagement.date_format' => 'Format de date invalide pour un engagement.',
            'engagements.*.est_formalise.required' => 'Le statut formalisé est requis pour chaque engagement.',
            'engagements.*.est_formalise.boolean' => 'Le statut formalisé est invalide pour un engagement.',
        ];

        $validator = Validator::make($request->all(), $validationRules, $validationMessages);

        if ($validator->fails()) {
            Log::warning('Validation failed during projet store:', $validator->errors()->toArray());
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $validatedData = $validator->validated(); // Get validated data

        // --- Database Transaction ---
        DB::beginTransaction();
        Log::info('Starting transaction for new projet creation');

        try {
            // 1. Create the Projet
            // Separate projet data from engagements data
            $projetInputData = collect($validatedData)->except('engagements')->all();

            // Important: Ensure fillable matches EXACTLY these keys if using create()
            $projet = Projet::create($projetInputData);
            Log::info("Projet created with ID_Projet: {$projet->ID_Projet}");

            // 2. Create EngagementFinancier records
            if (!empty($validatedData['engagements'])) {
                Log::info('Processing ' . count($validatedData['engagements']) . ' engagements.');
                foreach ($validatedData['engagements'] as $engagementData) {
                    // Add the projet_id to the engagement data
                    $engagementData['projet_id'] = $projet->ID_Projet;
                    EngagementFinancier::create($engagementData);
                }
                Log::info('Engagements created successfully.');
            } else {
                 Log::info('No engagements provided for this projet.');
            }

            // 3. Commit Transaction
            DB::commit();
            Log::info('Transaction committed successfully for projet ID: ' . $projet->ID_Projet);

            // 4. Return Success Response with the created Projet and its loaded relations
            $projet->load(['domaine', 'programme', 'chantier', 'convention', 'engagementsFinanciers.partenaire']);
            return response()->json([
                'message' => 'Projet et engagements créés avec succès.',
                'projet' => $projet
            ], 201);

        } catch (\Exception $e) {
            // 5. Rollback Transaction on error
            DB::rollBack();
            Log::error('Failed to store projet and engagements: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString() // Log trace for debugging
            ]);
            return response()->json(['message' => 'Erreur lors de la création du projet ou de ses engagements.'], 500);
        }
    }

    /**
     * Update the specified resource in storage, including engagements.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        Log::info("Attempting to update projet with ID_Projet: {$id}");

        // --- Find Existing Projet First ---
        try {
            // Use findOrFail based on the primary key ('ID_Projet' if set in model, 'id' otherwise)
            // If your primary key is 'ID_Projet', ensure it's set in the Projet model:
            // protected $primaryKey = 'ID_Projet';
            $projet = Projet::findOrFail($id);
        } catch (ModelNotFoundException $e) {
            Log::warning("Projet not found for update with ID_Projet: {$id}");
            return response()->json(['message' => 'Projet non trouvé.'], 404);
        }

        // --- Validation Rules ---
        // Define your rules here, matching the frontend and database schema
        $validationRules = [
            // Projet Fields (Ensure unique rule ignores the current projet)
            'Code_Projet' => [
                'required',
                'integer',
                Rule::unique('projet', 'Code_Projet')->ignore($projet->ID_Projet, 'ID_Projet') // Adjust primary key name if needed
            ],
            'Nom_Projet' => 'required|string|max:65535',
            'Id_Domaine' => ['required', 'integer', Rule::exists('domaine', 'Code')],
            'Id_Programme' => ['required', 'integer', Rule::exists('programme', 'Code_Programme')],
            'Id_Chantier' => ['required', 'integer', Rule::exists('chantier', 'Code_Chantier')],
            'Convention_Code' => ['nullable', 'integer', Rule::exists('convention', 'Code')],
            'Cout_CRO' => 'nullable|numeric|min:0',
            'Date_Debut' => 'nullable|date_format:Y-m-d',
            'Observations' => 'nullable|string',
            'Etat_Avan_Physi' => 'nullable|numeric|min:0|max:100',
            'Date_Fin' => 'nullable|date_format:Y-m-d|after_or_equal:Date_Debut',
            'Cout_Projet' => 'nullable|numeric|min:0',

            // Engagements Fields (must be present, can be empty array)
            'engagements' => 'present|array',
            // Validate fields within each engagement object
            'engagements.*.id' => [
                'sometimes', // Only validate if 'id' is present in the request item
                  // If 'id' key is present, it must have a non-empty value
                'integer',   // If present, must be an integer
                Rule::exists('engagements_financiers', 'id') // If present, must exist in the database table
            ], // Allow 'id' for existing engagements
            'engagements.*.partenaire_id' => 'required|integer|exists:partenaire,id', // Validate partner exists
            'engagements.*.montant_engage' => 'required|numeric|min:0',
            'engagements.*.date_engagement' => 'required|date_format:Y-m-d',
            'engagements.*.est_formalise' => 'required|boolean',
            'engagements.*.commentaire' => 'nullable|string|max:65535',

            // Confirmation flag validation (optional, boolean if present)
            'confirm_cascade_delete' => 'sometimes|boolean',
        ];

        // Define custom validation messages (translate as needed)
        $validationMessages = [
            'required' => 'Le champ :attribute est obligatoire.',
            'string' => 'Le champ :attribute doit être une chaîne.',
            'integer' => 'Le champ :attribute doit être un nombre entier.',
            'numeric' => 'Le champ :attribute doit être un nombre.',
            'boolean' => 'Le champ :attribute doit être vrai ou faux.',
            'date_format' => 'Le champ :attribute doit être au format AAAA-MM-JJ.',
            'unique' => 'La valeur du champ :attribute est déjà utilisée.',
            'exists' => 'La valeur sélectionnée pour :attribute est invalide.',
            'array' => 'Le champ :attribute doit être une liste.',
            'min' => 'Le champ :attribute doit être au moins :min.',
            'max' => 'Le champ :attribute ne doit pas dépasser :max.',
            'after_or_equal' => 'La :attribute doit être une date postérieure ou égale à la date de début.',
            'engagements.present' => 'La liste des engagements (même vide) doit être fournie.',
            'engagements.*.id.exists' => 'Un ID d\'engagement fourni est invalide.',
            'engagements.*.partenaire_id.required' => 'Le partenaire est requis pour chaque engagement.',
            'engagements.*.partenaire_id.exists' => 'Le partenaire sélectionné pour un engagement est invalide.',
            'engagements.*.montant_engage.required' => 'Le montant est requis pour chaque engagement.',
            'engagements.*.montant_engage.numeric' => 'Le montant doit être numérique pour chaque engagement.',
            'engagements.*.date_engagement.required' => 'La date est requise pour chaque engagement.',
            'engagements.*.date_engagement.date_format' => 'Format de date invalide pour un engagement.',
            'engagements.*.est_formalise.required' => 'Le statut formalisé est requis pour chaque engagement.',
            'engagements.*.est_formalise.boolean' => 'Le statut formalisé est invalide pour un engagement.',
            'confirm_cascade_delete.boolean' => 'La confirmation de suppression doit être une valeur booléenne.',
        ];

        $validator = Validator::make($request->all(), $validationRules, $validationMessages);

        if ($validator->fails()) {
            Log::warning("Validation failed during projet update (ID: {$id}):", $validator->errors()->toArray());
            return response()->json(['errors' => $validator->errors()], 422); // Unprocessable Entity
        }

        $validatedData = $validator->validated();
        // Extract the confirmation flag from the validated data (defaults to false if not present)
        $confirmCascadeDelete = $validatedData['confirm_cascade_delete'] ?? false;

        // --- Database Transaction ---
        // Use a transaction to ensure atomicity: either all changes succeed or none do.
        DB::beginTransaction();
        Log::info("Starting transaction for projet update ID: {$id}. Cascade Confirmation provided: " . ($confirmCascadeDelete ? 'Yes' : 'No'));

        try {
            // 1. Update the main Projet fields
            // Exclude engagement array and confirmation flag from projet data
            $projetInputData = collect($validatedData)->except(['engagements', 'confirm_cascade_delete'])->all();
            $projet->update($projetInputData);
            Log::info("Projet main fields updated for ID: {$id}");

            // --- Smarter Engagement Synchronization ---

            // Get IDs of engagements currently associated with this project
            $existingEngagementIds = $projet->engagementsFinanciers()->pluck('id')->toArray();

            $submittedEngagements = $validatedData['engagements'] ?? []; // Get submitted engagements array
            $submittedEngagementIdsWithId = []; // Keep track of IDs explicitly sent in the request (for update/keeping)

            $engagementsToCreate = []; // Array for engagements to be newly created
            $engagementsToUpdate = []; // Associative array [id => data] for engagements to be updated

            // Iterate through submitted engagements to determine if they are new or updates
            foreach ($submittedEngagements as $engagementData) {
                $currentId = $engagementData['id'] ?? null; // Get the ID if it exists in the submitted data

                if ($currentId && in_array($currentId, $existingEngagementIds)) {
                    // If ID exists and belongs to this project, it's an update or being kept
                    $submittedEngagementIdsWithId[] = $currentId;
                    $engagementsToUpdate[$currentId] = $engagementData; // Store data keyed by ID for update
                } elseif (!$currentId) {
                    // If no ID is present, it's a new engagement to be created
                    $engagementsToCreate[] = $engagementData;
                }
                // Implicitly ignore any submitted engagements with IDs that don't belong to this project
            }

            // Determine which existing engagements were *not* submitted, meaning they should be deleted
            $engagementIdsToDelete = array_diff($existingEngagementIds, $submittedEngagementIdsWithId);

            // --- Handle Deletions (with Confirmation Logic) ---
            if (!empty($engagementIdsToDelete)) {
                Log::info("Potential engagement IDs to delete for project {$id}: " . implode(', ', $engagementIdsToDelete));

                $versementsExistForDeleted = false;
                // Check for associated versements ONLY IF cascade confirmation is NOT provided
                if (!$confirmCascadeDelete) {
                    $versementsExistForDeleted = Versement::whereIn('engagement_id', $engagementIdsToDelete)->exists();
                    Log::info("Checking for versements for IDs to delete (no confirmation). Found: " . ($versementsExistForDeleted ? 'Yes' : 'No'));
                }

                if ($versementsExistForDeleted) {
                    // CONFLICT DETECTED: Versements exist, and user has not confirmed cascade delete.
                    DB::rollBack(); // Rollback the transaction before sending the conflict response
                    Log::warning("Update halted for projet ID {$id}: User confirmation required for deleting engagements with associated versements.");

                    // Optionally, fetch details of conflicting engagements to send to the frontend
                    $conflictingEngagements = EngagementFinancier::whereIn('id', $engagementIdsToDelete)
                                                ->with('partenaire:id,Description') // Eager load partner name (adjust columns if needed)
                                                ->get(['id', 'partenaire_id']); // Get only necessary fields

                     $details = $conflictingEngagements->map(function ($eng) {
                         $partnerName = $eng->partenaire->Description ?? 'Partenaire ID '.$eng->partenaire_id;
                         return "Engagement avec {$partnerName} (ID: {$eng->id})";
                     })->toArray();


                    // Return a specific 409 Conflict response indicating confirmation is needed
                    return response()->json([
                        'message' => 'Confirmation requise : La suppression de certains engagements entraînera la suppression définitive de leurs versements associés.',
                        'requires_confirmation' => true, // Flag for the frontend
                        'details' => $details // Send details about conflicting items
                    ], 409); // HTTP 409 Conflict status code
                } else {
                    // OK TO DELETE: Either no versements were found, or the user provided confirmation.
                    Log::info("Proceeding with deletion of engagement IDs for project {$id}: " . implode(', ', $engagementIdsToDelete) . ". Confirmation was " . ($confirmCascadeDelete ? 'provided' : 'not needed'));
                    // Perform the delete. If cascade is set up correctly in the DB, versements will be deleted automatically.
                    $deletedCount = EngagementFinancier::whereIn('id', $engagementIdsToDelete)->delete();
                    Log::info("Deleted {$deletedCount} engagements successfully.");
                }
            } else {
                 Log::info("No engagements marked for deletion for project {$id}.");
            }

            // --- Handle Updates ---
            if (!empty($engagementsToUpdate)) {
                Log::info("Updating " . count($engagementsToUpdate) . " engagements for project {$id}: " . implode(', ', array_keys($engagementsToUpdate)));
                foreach ($engagementsToUpdate as $idToUpdate => $dataToUpdate) {
                    // Prepare data: remove 'id' and ensure 'projet_id' is correct
                    unset($dataToUpdate['id']);
                    $dataToUpdate['projet_id'] = $projet->ID_Projet; // Ensure foreign key is set (adjust key name if needed)

                    // Update the engagement record where id and projet_id match
                    EngagementFinancier::where('id', $idToUpdate)
                                       ->where('projet_id', $projet->ID_Projet) // Add projet_id check for extra safety
                                       ->update($dataToUpdate);
                }
                 Log::info("Finished updating engagements for project {$id}.");
            }

            // --- Handle Creations ---
            if (!empty($engagementsToCreate)) {
                Log::info('Creating ' . count($engagementsToCreate) . ' new engagements for project ' . $id);
                foreach ($engagementsToCreate as $engagementData) {
                    // Prepare data: remove 'id' if somehow present, add 'projet_id'
                    unset($engagementData['id']);
                    $engagementData['projet_id'] = $projet->ID_Projet; // Set the foreign key
                    EngagementFinancier::create($engagementData);
                }
                 Log::info('Finished creating new engagements for project ' . $id);
            }

            // 3. Commit Transaction - If all operations were successful
            DB::commit();
            Log::info("Transaction committed successfully for projet update ID: {$id}");

            // 4. Return Success Response
            // Eager load relations again to return the updated project with its current engagements
            $projet->refresh()->load(['domaine', 'programme', 'chantier', 'convention', 'engagementsFinanciers.partenaire']);
            return response()->json([
                'message' => 'Projet et engagements mis à jour avec succès.',
                'projet' => $projet
            ], 200); // HTTP 200 OK

        } catch (\Exception $e) {
            // An error occurred, rollback the transaction
            DB::rollBack();
            Log::error("Failed to update projet (ID: {$id}) and engagements during transaction: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString() // Log the full stack trace for debugging
            ]);

            // Check if the error was specifically the foreign key constraint AFTER confirmation was supposedly given
            // This indicates a potential issue with the cascade setup or another constraint.
             if ($e instanceof QueryException && str_contains($e->getMessage(), '1451')) {
                  return response()->json(['message' => 'Erreur de base de données : Impossible de supprimer un engagement même après confirmation. Vérifiez les contraintes ou la configuration cascade.'], 500);
             }

            // Return a generic server error response
            return response()->json(['message' => 'Erreur serveur lors de la mise à jour du projet ou de ses engagements.'], 500); // HTTP 500 Internal Server Error
        }
    }
    /**
     * Remove the specified resource from storage.
     * Deletes associated engagements first.
     */
    public function destroy(string $id): JsonResponse // $id here is ID_Projet
    {
        Log::info("Attempting to delete projet with ID_Projet: {$id}");

        // --- Find Existing Projet First ---
        try {
            // Find the projet, we need the model instance to delete relations
            $projet = Projet::where('ID_Projet', $id)->firstOrFail();
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            Log::warning("Projet not found for deletion with ID_Projet: {$id}");
            return response()->json(['message' => 'Projet non trouvé.'], 404);
        }

        // --- Database Transaction ---
        DB::beginTransaction();
        Log::info("Starting transaction for projet deletion ID: {$id}");

        try {
            // 1. Delete related Engagements FIRST
            Log::info("Deleting associated engagements for projet ID: {$id}");
            $deletedEngagementsCount = $projet->engagementsFinanciers()->delete();
            Log::info("Deleted {$deletedEngagementsCount} associated engagements.");

            // 2. Delete the Projet itself
            $projet->delete();
            Log::info("Projet deleted successfully ID: {$id}");

            // 3. Commit Transaction
            DB::commit();
            Log::info("Transaction committed for projet deletion ID: {$id}");

            return response()->json(['message' => 'Projet et engagements associés supprimés avec succès.'], 200); // OK or 204 No Content

        } catch (\Exception $e) {
            // 4. Rollback Transaction on error
            DB::rollBack();
            Log::error("Failed to delete projet (ID: {$id}) or its engagements: " . $e->getMessage(), [
                 'trace' => $e->getTraceAsString()
            ]);
            // Consistent error message
            return response()->json(['message' => 'Erreur lors de la suppression du projet ou de ses engagements.'], 500);
        }
    }
}