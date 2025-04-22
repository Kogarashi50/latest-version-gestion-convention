<?php

namespace App\Http\Controllers;

use App\Models\AppelOffre;
use App\Models\Province; // Assuming needed for context or potential future use
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB; // Use for transactions if multiple operations needed
use Illuminate\Validation\Rule; // For advanced validation rules
use Exception;

class AppelOffreController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        try {
            // Eager load the 'province' relationship to avoid N+1 queries
            $query = AppelOffre::with('province')->orderBy('created_at', 'desc');

            // --- Optional Filtering (Example) ---
            // You can add filters based on request parameters if needed
            // if ($request->has('categorie')) {
            //     $query->where('categorie', $request->query('categorie'));
            // }
            // if ($request->has('province_id')) {
            //     $query->where('province_id', $request->query('province_id'));
            // }
            // --- End Optional Filtering ---

            // Use pagination for better performance with large datasets
            $perPage = $request->query('per_page', 10); // Default to 15 items per page
            $appelOffres = $query->paginate($perPage);

            // Log::info('Fetched Appel d\'offres Data:', $appelOffres->toArray()); // Log paginated data structure

            // Return the paginated response (includes data, links, meta)
            return response()->json($appelOffres, 200);

        } catch (Exception $e) {
            Log::error('Error fetching appels d\'offres: ' . $e->getMessage());
            return response()->json(['message' => 'Erreur lors de la récupération des appels d\'offres.'], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        // Define validation rules based on the schema
        $validatedData = $request->validate([
            'categorie' => ['required', Rule::in(['Travaux', 'Etudes', 'Services', 'Fournitures'])],
            'province_id' => 'nullable|integer|exists:province,Id', // Check existence against 'province' table 'Id' column
            'numero' => 'required|string|unique:appel_offre,numero', // Ensure numero is unique
            'intitule' => 'required|string',
            'estimation' => 'nullable|numeric|min:0',
            'estimation_HT' => 'required|numeric|min:0',
            'montant_TVA' => 'required|numeric|min:0',
            'duree_execution' => 'nullable|integer|min:0',
            'date_verification' => 'nullable|date_format:Y-m-d',
            'date_ouverture' => 'nullable|date_format:Y-m-d',
            'last_session_op' => 'nullable|date_format:Y-m-d',
            'lancement_portail' => 'nullable|boolean',
            'date_lancement_portail' => 'nullable|date_format:Y-m-d|required_if:lancement_portail,true', // Required if lancement_portail is true
        ]);

        // Laravel's boolean cast handles 'on', '1', true, etc. correctly for `lancement_portail`
        // Ensure default is handled if not present and nullable
        $validatedData['lancement_portail'] = $request->boolean('lancement_portail', false); // Default to false if not provided

        try {
            // Create the AppelOffre using validated data (safe due to $fillable in Model)
            $appelOffre = AppelOffre::create($validatedData);

            // Eager load the province relationship for the response
            $appelOffre->load('province');

            Log::info('Appel d\'offre created successfully: ID ' . $appelOffre->id);

            // Return the newly created resource with a 201 status code
            return response()->json(['message' => 'Appel d\'offre créé avec succès.', 'appel_offre' => $appelOffre], 201);

        } catch (Exception $e) {
            Log::error('Error creating appel d\'offre: ' . $e->getMessage());
            return response()->json(['message' => 'Erreur lors de la création de l\'appel d\'offre.'], 500);
        }
    }

    /**
     * Display the specified resource.
     *
     * @param string $id // Use string as route parameters are typically strings
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(string $id): JsonResponse
    {
        try {
            // Find the AppelOffre by ID, including the province relationship
            // findOrFail automatically throws a ModelNotFoundException (results in 404) if not found
            $appelOffre = AppelOffre::with('province')->findOrFail($id);

            return response()->json(['appel_offre' => $appelOffre], 200);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
             Log::warning('Appel d\'offre not found with ID: ' . $id);
             return response()->json(['message' => 'Appel d\'offre non trouvé.'], 404);
        } catch (Exception $e) {
            Log::error('Error fetching appel d\'offre ID ' . $id . ': ' . $e->getMessage());
            return response()->json(['message' => 'Erreur serveur lors de la récupération de l\'appel d\'offre.'], 500);
        }
    }

    /**
     * Update the specified resource in storage.
     *
     * @param \Illuminate\Http\Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, string $id): JsonResponse
    {
        try {
            // Find the existing AppelOffre first
            $appelOffre = AppelOffre::findOrFail($id);

            // Define validation rules for update
            $validatedData = $request->validate([
                'categorie' => ['required', Rule::in(['Travaux', 'Etudes', 'Services', 'Fournitures'])],
                'province_id' => 'nullable|integer|exists:province,Id', // Check existence against 'province' table 'Id' column
                'numero' => [
                    'required',
                    'string',
                   
                    Rule::unique('appel_offre', 'numero')->ignore($appelOffre->id), // Ignore current record ID for uniqueness check
                ],
                'intitule' => 'required|string',
                'estimation' => 'nullable|numeric|min:0',
                'estimation_HT' => 'required|numeric|min:0',
                'montant_TVA' => 'required|numeric|min:0',
                'duree_execution' => 'nullable|integer|min:0',
                'date_verification' => 'nullable|date_format:Y-m-d',
                'date_ouverture' => 'nullable|date_format:Y-m-d',
                'last_session_op' => 'nullable|date_format:Y-m-d',
                'lancement_portail' => 'nullable|boolean',
                'date_lancement_portail' => 'nullable|date_format:Y-m-d|required_if:lancement_portail,true',
            ]);

            // Handle boolean update correctly
            $validatedData['lancement_portail'] = $request->boolean('lancement_portail', $appelOffre->lancement_portail); // Use current value as default if not provided

            // Update the AppelOffre instance with validated data
            $appelOffre->update($validatedData);

            // Eager load the relationship for the response
            $appelOffre->load('province');

            Log::info('Appel d\'offre updated successfully: ID ' . $appelOffre->id);

            // Return the updated resource
            return response()->json(['message' => 'Appel d\'offre mis à jour avec succès.', 'appel_offre' => $appelOffre], 200);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            Log::warning('Appel d\'offre not found for update with ID: ' . $id);
            return response()->json(['message' => 'Appel d\'offre non trouvé.'], 404);
        } catch (\Illuminate\Validation\ValidationException $e) {
            // Validation errors are usually handled automatically by Laravel's exception handler
            // returning a 422 response, but you can catch explicitly if needed.
            Log::warning('Validation failed during update for Appel d\'offre ID ' . $id . ': ', $e->errors());
            return response()->json(['message' => 'Données invalides.', 'errors' => $e->errors()], 422);
        } catch (Exception $e) {
            Log::error('Error updating appel d\'offre ID ' . $id . ': ' . $e->getMessage());
            return response()->json(['message' => 'Erreur lors de la mise à jour de l\'appel d\'offre.'], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(string $id): JsonResponse
    {
        // !! IMPORTANT: Avoid disabling foreign key checks !!
        // Database constraints should handle deletion rules (e.g., RESTRICT, CASCADE, SET NULL).
        // If deletion fails due to constraints, it's often the desired behavior.

        try {
            // Find the AppelOffre first
            $appelOffre = AppelOffre::findOrFail($id);

            // Attempt to delete the record
            $appelOffre->delete();

            Log::info('Appel d\'offre deleted successfully: ID ' . $id);

            // Return a success response with no content
            // return response()->json(['message' => 'Appel d\'offre supprimé avec succès.'], 200); // Option 1: Message
            return response()->json(null, 204); // Option 2: Standard No Content response

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            Log::warning('Appel d\'offre not found for deletion with ID: ' . $id);
            return response()->json(['message' => 'Appel d\'offre non trouvé.'], 404);
        } catch (\Illuminate\Database\QueryException $e) {
            // Catch potential foreign key constraint violations
            // SQLSTATE[23000]: Integrity constraint violation...
             if ($e->getCode() == 23000) { // Check for integrity constraint violation code
                Log::warning('Failed to delete Appel d\'offre ID ' . $id . ' due to foreign key constraints.');
                return response()->json(['message' => 'Impossible de supprimer cet appel d\'offre car il est lié à d\'autres enregistrements.'], 409); // 409 Conflict is appropriate
             }
             // Handle other database errors
             Log::error('Database error deleting appel d\'offre ID ' . $id . ': ' . $e->getMessage());
             return response()->json(['message' => 'Erreur base de données lors de la suppression.'], 500);
         } catch (Exception $e) {
            Log::error('Error deleting appel d\'offre ID ' . $id . ': ' . $e->getMessage());
            return response()->json(['message' => 'Erreur lors de la suppression de l\'appel d\'offre.'], 500);
        }
    }
}