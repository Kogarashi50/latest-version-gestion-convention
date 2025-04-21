<?php

namespace App\Http\Controllers;

use App\Models\OrdreService;
use App\Models\MarchePublic; // Needed for validation (exists rule)
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Auth; // Optional: If using authentication for cree_par

class OrdreServiceController extends Controller
{
    // Base path for storing attached files within the 'public' disk.
    // Remember to run `php artisan storage:link`
    private $filePathPrefix = 'ordres_service/attachments';

    /**
     * Display a listing of all OrdreService resources.
     * GET /api/ordres-service
     */
    public function index(Request $request)
    {
        // Optional: Add authorization check if needed
        // Gate::authorize('viewAny', OrdreService::class);

        try {
            Log::info("Fetching list of all Ordres de Service.");
            $query = OrdreService::with(
                // Eager load necessary fields from the related MarchePublic
                'marchePublic:id,numero_marche,intitule'
            );

            // --- Searching ---
            if ($search = $request->query('search')) {
                Log::debug("Searching Ordres de Service for term.", ['search_term' => $search]);
                $query->where(function($q) use ($search) {
                    $q->where('numero', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%")
                      ->orWhereHas('marchePublic', function ($subQuery) use ($search) {
                          $subQuery->where('numero_marche', 'like', "%{$search}%")
                                    ->orWhere('intitule', 'like', "%{$search}%");
                      });
                });
            }

            // --- Filtering by Marche Public ---
            if ($marcheId = $request->query('marche_id')) {
                 Log::debug("Filtering Ordres de Service by marche_id.", ['marche_id' => $marcheId]);
                $query->where('marche_id', $marcheId);
            }

            // --- Filtering by Type ---
             if ($type = $request->query('type')) {
                 if (in_array($type, ['commencement', 'arret'])) {
                     Log::debug("Filtering Ordres de Service by type.", ['type' => $type]);
                     $query->where('type', $type);
                 } else {
                      Log::warning("Invalid type filter received.", ['type_received' => $type]);
                 }
             }

            // --- Sorting ---
            $sortField = $request->query('sort', 'date_emission');
            $sortDirection = $request->query('direction', 'desc');
            $allowedSorts = ['numero', 'date_emission', 'type'];

            if (in_array($sortField, $allowedSorts)) {
                Log::debug("Sorting Ordres de Service.", ['sort_by' => $sortField, 'direction' => $sortDirection]);
                $query->orderBy($sortField, $sortDirection);
            } else {
                 $query->orderBy('date_emission', 'desc'); // Default sort
            }


            // --- Pagination or Get All ---
             $perPage = $request->query('per_page', 15);
             Log::debug("Paginating results.", ['per_page' => $perPage]);
             $ordres = $query->paginate($perPage); // Use pagination

            Log::info("Successfully fetched Ordres de Service list/page.");
            return response()->json($ordres); // Return paginated response

        } catch (\Exception $e) {
            Log::error("Error fetching all Ordres de Service list: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erreur serveur lors de la récupération des ordres de service.'], 500);
        }
    }

    /**
     * Store a newly created OrdreService resource in storage.
     * POST /api/ordres-service
     * Expects 'marche_id' in the request body.
     */
    public function store(Request $request)
    {
        // Optional: Add authorization check if needed
        // Gate::authorize('create', OrdreService::class);

        Log::info("--- Standalone OrdreService Store Request Received ---");
        Log::debug('Raw Request Keys.', ['keys' => array_keys($request->all())]);
        Log::debug('Uploaded File Info check.', ['has_file' => $request->hasFile('fichier_joint') && $request->file('fichier_joint')?->isValid()]);
        Log::debug('Received marche_id value.', ['marche_id' => $request->input('marche_id')]);

        $validator = Validator::make($request->all(), [
            'marche_id' => [
                'required',
                'integer',
                Rule::exists('marche_public', 'id') // Ensure the MarchePublic exists
            ],
            'type' => ['required', Rule::in(['commencement', 'arret'])],
            'numero' => [
                'required',
                'string',
                'max:100',
                // Unique within the specific marche_id provided in the request
                 Rule::unique('ordre_service', 'numero')
                    ->where(function ($query) use ($request) {
                        return $query->where('marche_id', $request->input('marche_id')); // Use input marche_id
                    })
            ],
            'date_emission' => 'required|date_format:Y-m-d',
            'description' => 'nullable|string',
            'fichier_joint' => [
                'nullable',
                'file',
                'mimes:pdf,doc,docx,xls,xlsx,jpg,jpeg,png,dwg,zip,rar', // Adjust as needed
                'max:20480', // 20MB example - ADJUST AS NEEDED
            ],
            // cree_par is set automatically below
        ]);

        if ($validator->fails()) {
            Log::error("Standalone OrdreService Store validation failed.", ['errors' => $validator->errors()->toArray()]);
            return response()->json(['message' => 'Erreurs de validation.', 'errors' => $validator->errors()], 422);
        }
        Log::info('Standalone OrdreService Store validation passed.');

        $validatedData = $validator->validated();
        $storedFilePath = null;

        // --- Transaction Optional - Consider if multiple critical steps ---
        // DB::beginTransaction();

        try {
            // 1. Handle File Upload (if present)
            if ($request->hasFile('fichier_joint') && $request->file('fichier_joint')->isValid()) {
                $file = $request->file('fichier_joint');
                $originalName = $file->getClientOriginalName();
                // Store under a subdirectory named after the marche_id for better organization
                $targetPath = $this->filePathPrefix . '/' . $validatedData['marche_id'];
                Log::info("Storing OrdreService file.", ['original_name' => $originalName, 'target_path' => $targetPath]);

                $storedFilePath = $file->storeAs($targetPath, $originalName, 'public');

                if (!$storedFilePath) {
                    Log::error("Failed to store OrdreService file.", ['original_name' => $originalName]);
                    throw new \Exception("Erreur lors du stockage du fichier joint.");
                }
                Log::info("OrdreService file stored.", ['stored_path' => $storedFilePath]);
                $validatedData['fichier_joint'] = $storedFilePath; // Use the stored path for DB
            } else {
                // Ensure field is null if no file uploaded
                $validatedData['fichier_joint'] = null;
            }


            // --- CORRECTED Section for Setting Creator ID ---
            // 2. Set Creator ID using the authenticated user model
            $authenticatedUser = $request->user(); // Get the authenticated Utilisateur model instance

            if ($authenticatedUser) {
                // Access the correct primary key defined in your Utilisateur model
                $userId = $authenticatedUser->idutilisateur; // <-- Use the correct primary key name

                Log::debug('Attempting to set cree_par from request user.', [
                    'user_found' => true,
                    'user_id_value' => $userId,         // Log the value retrieved
                    'user_id_type' => gettype($userId) // Log the data type
                ]);

                // Double-check if the retrieved ID is actually an integer
                if (is_numeric($userId) && filter_var($userId, FILTER_VALIDATE_INT) !== false) {
                    $validatedData['cree_par'] = (int) $userId; // Assign the integer ID
                } else {
                     // Log an error if the primary key wasn't an integer as expected
                     Log::error('User primary key (idutilisateur) did not return an integer value!', [
                        'value_returned' => $userId,
                        'type_returned' => gettype($userId)
                     ]);
                     // Set to null if the column is nullable, otherwise this will cause an error later
                     $validatedData['cree_par'] = null;
                     // If cree_par MUST have a value, you might want to throw an exception here instead:
                     // throw new \Exception('Authenticated user ID is not a valid integer.');
                }
            } else {
                 // Handle case where no user is authenticated (e.g., API token issue)
                 Log::warning('No authenticated user found via $request->user() for cree_par, setting to null.');
                 $validatedData['cree_par'] = null;
            }
            // --- END CORRECTED Section ---


            // Keep this check: Remove 'fichier_joint' key if value is null
            // (Only strictly needed if the DB column *cannot* be NULL)
            if (array_key_exists('fichier_joint', $validatedData) && is_null($validatedData['fichier_joint'])) {
                unset($validatedData['fichier_joint']);
            }

             // Keep this check: Remove 'cree_par' key if value is null
             // (Only strictly needed if the DB column *cannot* be NULL)
            if (array_key_exists('cree_par', $validatedData) && is_null($validatedData['cree_par'])) {
                // If your 'cree_par' column *can* be NULL, you can REMOVE this unset line.
                // If it *cannot* be NULL, and you didn't throw an exception above when the ID was invalid,
                // this unset might be necessary, but it's better to ensure a valid ID or handle the error earlier.
                // unset($validatedData['cree_par']);
            }


            // 3. Create Database Record
            Log::info("Creating OrdreService record with validated data.", ['data' => $validatedData]);
            $ordreService = OrdreService::create($validatedData);
            Log::info("OrdreService created successfully.", ['id' => $ordreService->id]);

            // 4. Eager load relationship for the response
            $ordreService->load('marchePublic:id,numero_marche,intitule');

            // DB::commit(); // Commit if using transaction

            return response()->json(['message' => 'Ordre de service créé avec succès.', 'ordre_service' => $ordreService], 201);

        } catch (\Throwable $e) {
            // DB::rollBack(); // Rollback if using transaction
            Log::error("Error creating Ordre Service: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);

            // Attempt to cleanup stored file if creation failed AFTER storage
            if ($storedFilePath && Storage::disk('public')->exists($storedFilePath)) {
                Log::warning("Attempting cleanup of stored file due to creation error.", ['file_path' => $storedFilePath]);
                try {
                    Storage::disk('public')->delete($storedFilePath);
                    Log::info("Cleaned up stored file.", ['file_path' => $storedFilePath]);
                } catch (\Exception $fsEx) {
                    Log::error("Failed to cleanup stored file during error handling.", ['file_path' => $storedFilePath, 'exception' => $fsEx->getMessage()]);
                }
            }

            // Provide specific error message if possible (e.g., from caught exception)
            $errorMessage = 'Erreur serveur lors de la création.';
            if ($e instanceof \Illuminate\Database\QueryException && str_contains($e->getMessage(), 'constraint violation')) {
                 $errorMessage = 'Erreur de base de données lors de la création (vérifiez les contraintes).';
            } elseif ($e instanceof \Exception && $e->getMessage() === 'Erreur lors du stockage du fichier joint.') {
                 $errorMessage = 'Erreur lors du stockage du fichier joint.';
            }

            return response()->json(['message' => $errorMessage, 'error_details' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified OrdreService resource.
     * GET /api/ordres-service/{ordre_service}
     */
    public function show(OrdreService $ordre_service)
    {
        // Optional: Add authorization check here if needed
        // Gate::authorize('view', $ordre_service);

        try {
             $ordre_service->load('marchePublic:id,numero_marche,intitule');
             Log::info("Showing OrdreService details.", ['id' => $ordre_service->id]);
             return response()->json(['ordre_service' => $ordre_service]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
             // Use the ID from the request if the model binding failed before this point
             $requestedId = request()->route('ordre_service');
             Log::warning("Ordre de service not found during show.", ['id_requested' => $requestedId]);
             return response()->json(['message' => 'Ordre de service non trouvé.'], 404);
        } catch (\Exception $e) {
             Log::error("Error fetching Ordre Service ID {$ordre_service->id}: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]); // Use bound model ID if available
             return response()->json(['message' => 'Erreur serveur.'], 500);
        }
    }

  
    public function update(Request $request, OrdreService $ordre_service)
    {
        // Optional: Add authorization check here if needed
        // Gate::authorize('update', $ordre_service);

        Log::info("--- OrdreService Update Request Received ---", ['id' => $ordre_service->id]);
        Log::debug('Raw Request Keys.', ['keys' => array_keys($request->all())]);
        Log::debug('Uploaded File Info check.', ['has_file' => $request->hasFile('fichier_joint') && $request->file('fichier_joint')?->isValid()]);
        Log::debug('Delete File Flag value.', ['delete_flag' => $request->input('delete_fichier_joint')]);
        Log::debug('Received marche_id for update.', ['marche_id' => $request->input('marche_id')]); // Log incoming marche_id

        // Validation rules for update - NOW INCLUDES marche_id
        $validator = Validator::make($request->all(), [
            // *** Add validation for marche_id during update ***
            'marche_id' => [
                'required', // Make it required if changing is allowed
                'integer',
                Rule::exists('marche_public', 'id') // Ensure the new MarchePublic exists
            ],
            'type' => ['required', Rule::in(['commencement', 'arret'])],
            'numero' => [
                'required',
                'string',
                'max:100',
                 // Unique within the potentially *new* marche_id provided in the request, ignoring self
                Rule::unique('ordre_service', 'numero')
                    ->where(function ($query) use ($request) {
                         // Use the incoming marche_id from the request for the check
                        return $query->where('marche_id', $request->input('marche_id'));
                    })
                    ->ignore($ordre_service->id) // Ignore the current record ID
            ],
            'date_emission' => 'required|date_format:Y-m-d',
            'description' => 'nullable|string',
            'fichier_joint' => [
                'nullable', 'file',
                'mimes:pdf,doc,docx,xls,xlsx,jpg,jpeg,png,dwg,zip,rar',
                'max:20480',
            ],
            'delete_fichier_joint' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            Log::error("OrdreService Update validation failed.", ['id' => $ordre_service->id, 'errors' => $validator->errors()->toArray()]);
            return response()->json(['message' => 'Erreurs de validation.', 'errors' => $validator->errors()], 422);
        }
        Log::info("OrdreService Update validation passed.", ['id' => $ordre_service->id]);

        $validatedData = $validator->validated(); // Now includes marche_id
        $oldFilePath = $ordre_service->fichier_joint;
        $newFilePath = null;
        $fileToDelete = null;

        // --- Determine target directory for NEW files ---
        // Use the INCOMING marche_id from the validated data for the new file path
        $targetMarcheIdForNewFile = $validatedData['marche_id'];

        DB::beginTransaction();
        Log::info("OrdreService Update transaction started.", ['id' => $ordre_service->id]);

        try {
            // --- Handle File Logic ---
            $deleteExistingFile = $request->boolean('delete_fichier_joint');

            if ($request->hasFile('fichier_joint') && $request->file('fichier_joint')->isValid()) {
                $file = $request->file('fichier_joint');
                $originalName = $file->getClientOriginalName();
                // *** Store new file under the potentially NEW marche_id subdir ***
                $targetPath = $this->filePathPrefix . '/' . $targetMarcheIdForNewFile;
                Log::info("Storing NEW OrdreService file for update.", ['id' => $ordre_service->id, 'original_name' => $originalName, 'target_path' => $targetPath]);

                $newFilePath = $file->storeAs($targetPath, $originalName, 'public');
                if (!$newFilePath) throw new \Exception("Erreur stockage nouveau fichier.");

                Log::info("New file stored.", ['stored_path' => $newFilePath]);
                $validatedData['fichier_joint'] = $newFilePath;
                // Mark old file for deletion regardless of marche_id change
                if ($oldFilePath) $fileToDelete = $oldFilePath;

            } elseif ($deleteExistingFile && $oldFilePath) {
                Log::info("Explicitly deleting existing file.", ['id' => $ordre_service->id, 'file_path' => $oldFilePath]);
                $validatedData['fichier_joint'] = null; // Set path to null in DB
                $fileToDelete = $oldFilePath; // Mark old file for storage deletion
            } else {
                // Keep existing file path - UNSET fichier_joint from validated data
                // This PREVENTS overwriting the existing path if no new file/delete action.
                // If marche_id changes but file doesn't, the path still points to the old location.
                unset($validatedData['fichier_joint']);
                Log::debug("Keeping existing file path (if any).", ['id' => $ordre_service->id, 'path' => $oldFilePath]);
            }
            unset($validatedData['delete_fichier_joint']);

            // --- Update Database Record ---
            // validatedData now includes 'marche_id' which will be updated
            Log::info("Updating OrdreService record.", ['id' => $ordre_service->id, 'data' => $validatedData]);
            $ordre_service->update($validatedData); // Update using all validated data
            Log::info("OrdreService record updated successfully.", ['id' => $ordre_service->id]);

            // --- Commit Transaction ---
            DB::commit();
            Log::info("OrdreService Update transaction committed.", ['id' => $ordre_service->id]);

            // --- Delete Old File from Storage (AFTER commit) ---
            // This deletes the file from its ORIGINAL location if it was replaced or marked for deletion.
            if ($fileToDelete && Storage::disk('public')->exists($fileToDelete)) {
                 Log::info("Attempting physical deletion of old/replaced file.", ['file_path' => $fileToDelete]);
                 try {
                     Storage::disk('public')->delete($fileToDelete);
                     Log::info("Successfully deleted file from storage.", ['file_path' => $fileToDelete]);
                 } catch (\Exception $fsEx) {
                     Log::error("Failed to delete file from storage post-commit.", ['file_path' => $fileToDelete, 'exception' => $fsEx->getMessage()]);
                 }
            }

            // Return the updated model, eager loading the relationship
            $ordre_service->load('marchePublic:id,numero_marche,intitule');
            return response()->json(['message' => 'Ordre de service mis à jour.', 'ordre_service' => $ordre_service]);

        } catch (\Throwable $e) {
            DB::rollBack();
            // ... (keep existing error handling and rollback cleanup for $newFilePath) ...
             Log::error("Error updating Ordre Service ID {$ordre_service->id}: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            if ($newFilePath && Storage::disk('public')->exists($newFilePath)) {
                Log::warning("Rolling back transaction. Attempting cleanup of newly stored file.", ['file_path' => $newFilePath]);
                try { Storage::disk('public')->delete($newFilePath); Log::info("Cleaned up newly stored file.", ['file_path' => $newFilePath]); }
                catch (\Exception $fsEx) { Log::error("Rollback cleanup: Failed to delete newly stored file.", ['file_path' => $newFilePath, 'exception' => $fsEx->getMessage()]); }
            }
            $errorMessage = 'Erreur serveur lors de la mise à jour.';
             if ($e instanceof \Exception && $e->getMessage() === 'Erreur stockage nouveau fichier.') { $errorMessage = 'Erreur lors du stockage du nouveau fichier joint.'; }
            return response()->json(['message' => $errorMessage, 'error_details' => $e->getMessage()], 500);
        }
    }
    
    
    public function destroy(OrdreService $ordre_service)
    {
        // Optional: Add authorization check here if needed
        // Gate::authorize('delete', $ordre_service);

        Log::info("--- OrdreService Destroy Request Received ---", ['id' => $ordre_service->id]);
        $filePath = $ordre_service->fichier_joint; // Get path BEFORE deleting record

        DB::beginTransaction();
        Log::info("OrdreService Destroy transaction started.", ['id' => $ordre_service->id]);

        try {
            // --- Delete Database Record ---
            Log::info("Deleting OrdreService record.", ['id' => $ordre_service->id]);
            $deleted = $ordre_service->delete();

            if (!$deleted) throw new \Exception("Database deletion failed.");
            Log::info("OrdreService record deleted successfully.", ['id' => $ordre_service->id]);

            // --- Commit Transaction ---
            DB::commit();
            Log::info("OrdreService Destroy transaction committed.", ['id' => $ordre_service->id]);

            // --- Delete File from Storage (AFTER commit) ---
            if ($filePath && Storage::disk('public')->exists($filePath)) {
                 Log::info("Attempting physical deletion of associated file.", ['file_path' => $filePath]);
                 try {
                     Storage::disk('public')->delete($filePath);
                     Log::info("Successfully deleted file from storage.", ['file_path' => $filePath]);
                 } catch (\Exception $storageEx) {
                     // Log error but don't fail the overall request
                     Log::error("Error deleting file from storage post-commit.", ['file_path' => $filePath, 'exception' => $storageEx->getMessage()]);
                 }
            } else if ($filePath) {
                 Log::warning("Associated file path recorded in DB, but not found in storage.", ['file_path' => $filePath]);
            }


            return response()->json(['message' => 'Ordre de service supprimé avec succès.'], 200); // Or 204 No Content

        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("Error deleting Ordre Service ID {$ordre_service->id}: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            // Provide specific error message for constraint violation
            if ($e instanceof \Illuminate\Database\QueryException && str_contains($e->getMessage(), 'constraint violation')) {
                 return response()->json(['message' => 'Impossible de supprimer: l\'ordre est peut-être lié à d\'autres enregistrements.'], 409); // 409 Conflict
            }
            return response()->json(['message' => 'Erreur serveur lors de la suppression.', 'error_details' => $e->getMessage()], 500);
        }
    }
}