<?php

namespace App\Http\Controllers;

use App\Models\SousProjet; // Use the SousProjet model
use App\Models\Projet;     // Needed for validation checks
use App\Models\Province;   // Needed for validation checks
use App\Models\Commune;    // Needed for validation checks
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class SousProjetController extends Controller
{
    /**
     * Display a listing of the resource.
     * Mirrors PartenaireController index structure.
     */
    public function index(): JsonResponse
    {
        try {
            // Eager load relationships matching the model definition
            $sousprojets = SousProjet::with(['projet', 'province', 'commune'])
                ->orderBy('created_at', 'desc') // Example ordering
                ->get();
            // Return under 'sousprojets' key to match frontend dataKey
            return response()->json(['sousprojets' => $sousprojets], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching sousprojets: ' . $e->getMessage());
            return response()->json(['failed' => 'Erreur lors de la récupération des sous projets'], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     * Mirrors PartenaireController destroy structure. Uses 'ID'.
     */
    public function destroy(string $id): JsonResponse
    {
        // Log::info('Attempting to delete sousprojet with ID: ' . $id);

        try {
             // Find first to check existence before returning status - using 'ID'
             $sousprojet = SousProjet::where('Code_Sous_Projet', $id)->first();

             DB::statement('SET FOREIGN_KEY_CHECKS=0;'); // Replicating pattern

             if (!$sousprojet) {
                 DB::statement('SET FOREIGN_KEY_CHECKS=1;'); // Re-enable
                 // Log::warning('SousProjet not found with ID: ' . $id);
                 return response()->json(['failed' => 'non trouve '], 404); // Mimicking response
             }

            // Use where()->delete() as requested, using 'ID'
            $deleted = SousProjet::where('Code_Sous_Projet', $id)->delete();

            DB::statement('SET FOREIGN_KEY_CHECKS=1;'); // Re-enable

            if ($deleted) {
                // Log::info('SousProjet deleted successfully with ID: ' . $id);
                return response()->json(['success' => 'done done'], 200); // Mimicking response
            } else {
                // Log::warning('SousProjet deletion returned 0 or false for ID: ' . $id);
                return response()->json(['failed' => 'non trouve '], 404); // Mimicking response
            }
        } catch (\Exception $e) {
            // Log::error('Failed to delete sousprojet with ID: ' . $id . '. Error: ' . $e->getMessage());
            try { DB::statement('SET FOREIGN_KEY_CHECKS=1;'); } catch (\Exception $dbException) { Log::error('Failed to re-enable FK checks on error: ' . $dbException->getMessage()); }
            return response()->json(['failed' => 'process shut down'], 400); // Mimicking response
        }
    }

    /**
     * Display the specified resource.
     * Mirrors PartenaireController show structure. Uses 'ID'.
     */
    public function show(string $id): JsonResponse
    {
        try {
            // Find using 'ID' column
            $sousprojet = SousProjet::where('Code_Sous_Projet', $id)->first();

            if (!$sousprojet) {
                 // Mimicking PartenaireController 404 response on not found
                return response()->json(['error', 'Sous Projet n\'existe pas.'], 404); // Adjusted message
            }

            // Eager load relationships for the single view
            $sousprojet->load(['projet', 'province', 'commune']);

            return response()->json(['sousprojet' => $sousprojet], 200); // Return under 'sousprojet' key

        } catch (\Exception $e) {
            Log::error('Error fetching sousprojet ID ' . $id . ': ' . $e->getMessage());
            return response()->json(['failed' => 'Erreur serveur lors de la récupération du sous projet'], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     * Mirrors PartenaireController store structure.
     */
      /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        // Validate using EXACT frontend keys
        // Use validated() to get only the data that passed validation
        $validatedData = $request->validate([ // Assign the validated data
            'Code_Sous_Projet' => 'required|string|max:255|unique:sous_projet,Code_Sous_Projet',
            'Nom_Projet' => 'required|string|max:65535',
            // Validate Foreign Keys exist in their respective tables' Primary Key columns
            'ID_Projet_Maitre' => ['required', Rule::exists('projet', 'Code_Projet')],
            'Id_Province' => ['required', Rule::exists('province', 'Id')],
            'Id_Commune' => ['required', Rule::exists('commune', 'Id')], // Ensure 'Id' is correct PK for commune
            'Observations' => 'nullable|string',
            'Etat_Avan_Physi' => 'required|numeric|min:0|max:100',
            'Etat_Avan_Finan' => 'required|numeric|min:0|max:100',
            'Estim_Initi' => 'required|numeric|min:0',
            'Secteur' => 'required|string|max:255',
            'Localite' => 'nullable|string|max:255',
            'Centre' => 'nullable|string|max:255',
            'Site' => 'nullable|string|max:255',
            'Surface' => 'nullable|numeric|min:0',
            'Lineaire' => 'nullable|numeric|min:0',
            'Status' => 'required|string|max:255',
            'Douars_Desservis' => 'nullable|string',
            'Financement' => 'nullable|string',
            'Nature_Intervention' => 'nullable|string',
            'Benificiaire' => 'nullable|string',
        ]);

        // --- You can remove the dd() now, or leave it temporarily ---
        // dd($validatedData); // Dump only the validated data

        try {
            // **** CHANGED: Use $validatedData instead of $request->all() ****
            // This prevents mass assignment exceptions if $fillable is correct for these fields
            $sousProjet = SousProjet::create($validatedData); // Assign created model if needed

            // Return a success response with the created data (optional but good practice)
            return response()->json([
                'success' => 'Sous-projet créé avec succès',
                'sousprojet' => $sousProjet // Return the newly created model
            ], 201); // Use 201 Created status code

        }
        // This catch block is usually not needed when using $request->validate()
        // catch (\Illuminate\Validation\ValidationException $e) {
        //     return response()->json(['errors' => $e->errors()], 422);
        // }
        catch (\Exception $e) {
             Log::error('Failed to store sousprojet: ' . $e->getMessage(), [
                 'exception' => $e,
                 'data' => $validatedData // Log the data that was attempted
             ]);

             // **** CHANGED: Return 500 Internal Server Error ****
             // Provide more info during development
             return response()->json([
                 'failed' => 'Échec de la création du sous-projet',
                 'error_details' => config('app.debug') ? $e->getMessage() : 'Erreur interne du serveur.',
                 'trace' => config('app.debug') ? $e->getTraceAsString() : null, // Only show trace in debug mode
             ], 500); // Use 500 status code
        }
    }
    /**
     * Update the specified resource in storage.
     * Mirrors PartenaireController update structure. Uses 'ID'.
     */
    public function update(Request $request, string $id): JsonResponse // $id is Code_Sous_Projet from URL
    {
        // 1. Find the existing model or fail with a 404 Not Found response
        // Use firstOrFail to automatically handle the "not found" case
        $sousprojet = SousProjet::where('Code_Sous_Projet', $id)->firstOrFail();

        // 2. Validate the incoming data
        // Use $request->validated() which returns only validated fields
        $validatedData = $request->validate([
            'Nom_Projet' => 'required|string|max:65535',
            'ID_Projet_Maitre' => ['required', Rule::exists('projet', 'Code_Projet')],
            'Id_Province' => ['required', Rule::exists('province', 'Id')],
            'Id_Commune' => ['required', Rule::exists('commune', 'Id')], // Ensure 'Id' is correct PK for commune
            'Observations' => 'nullable|string',
            'Etat_Avan_Physi' => 'required|numeric|min:0|max:100',
            'Etat_Avan_Finan' => 'required|numeric|min:0|max:100',
            'Estim_Initi' => 'required|numeric|min:0',
            'Secteur' => 'required|string|max:255',
            'Localite' => 'nullable|string|max:255',
            'Centre' => 'nullable|string|max:255',
            'Site' => 'nullable|string|max:255',
            'Surface' => 'nullable|numeric|min:0',
            'Lineaire' => 'nullable|numeric|min:0',
            'Status' => 'required|string|max:255',
            'Douars_Desservis' => 'nullable|string',
            'Financement' => 'nullable|string',
            'Nature_Intervention' => 'nullable|string',
            'Benificiaire' => 'nullable|string',
        ]);

        // $validatedData now contains only the fields that passed validation
       try{

       

        $update = SousProjet::where('Code_Sous_Projet', $id)->update($validatedData);

        DB::statement('SET FOREIGN_KEY_CHECKS=1;'); // Re-enable

        if ($update) {
            // Log::info('SousProjet deleted successfully with ID: ' . $id);
            return response()->json(['success' => 'done done'], 200); // Mimicking response
        } else {
            // Log::warning('SousProjet deletion returned 0 or false for ID: ' . $id);
            return response()->json(['failed' => 'non trouve '], 404); // Mimicking response
        }
    } catch (\Exception $e) {
        // Log::error('Failed to delete sousprojet with ID: ' . $id . '. Error: ' . $e->getMessage());
        try { DB::statement('SET FOREIGN_KEY_CHECKS=1;'); } catch (\Exception $dbException) { Log::error('Failed to re-enable FK checks on error: ' . $dbException->getMessage()); }
        return response()->json(['failed' => 'process shut down'], 400); // Mimicking response
    }
    
}}