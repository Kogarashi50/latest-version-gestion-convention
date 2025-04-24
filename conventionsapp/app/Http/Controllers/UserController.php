<?php

namespace App\Http\Controllers;

// Core Laravel & Model Imports
use App\Models\User;
use App\Models\Fonctionnaire;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Exception;
use Illuminate\Support\Facades\Auth;
use Spatie\Permission\Models\Role; // <-- Import Role model
use Illuminate\Http\JsonResponse; // <-- Make sure it's THIS namespace
use Illuminate\Support\Facades\DB;
class UserController extends Controller
{
    private $guardName = 'sanctum'; // Or your relevant API guard name

    /**
     * Display a listing of the resource.
     * GET /users
     */
    public function index()
    {
        // Authorization is handled by route middleware ('role:Admin' in api.php)
        try {
            // Eager load fonctionnaire AND roles (only need name)
            $users = User::with(['fonctionnaire', 'roles:id,name'])->latest()->get();
            return response()->json(['users' => $users], 200);

        } catch (Exception $e) {
            Log::error('Error fetching users: ' . $e->getMessage());
            return response()->json(['message' => 'Erreur lors de la récupération des utilisateurs.'], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     * POST /users
     */
    public function store(Request $request)
    {
        // Authorization is handled by route middleware

        // --- Validation (Added 'role') ---
        $data = $request->validate([
            'email' => [
                'required','string','email','max:255',
                Rule::unique('users', 'email')
            ],
            'password' => 'required|string|min:8',
            'status' => [
                'required','string', Rule::in(['active', 'inactive', 'suspended'])
            ],
            'fonctionnaire_id' => [
                'required', 'integer', Rule::exists('fonctionnaires', 'id'),
                // Rule::unique('users', 'fonctionnaire_id') // Optional
            ],
            // --- ADDED Role Validation ---
            'role' => [
                'required', 'string',
                // Ensure the role name exists for the correct guard
                Rule::exists('roles', 'name')->where('guard_name', $this->guardName)
            ]
            // ---
        ]);

        try {
            $user = User::create([
                'email' => $data['email'],
                'password' => $data['password'], // Hashing handled by model
                'fonctionnaire_id' => $data['fonctionnaire_id'],
                'status' => $data['status'],
            ]);

            // --- ADDED: Assign Role ---
            // Use syncRoles to ensure only this role is assigned
            $user->syncRoles([$data['role']]);
            // ---

            $user->load(['fonctionnaire', 'roles:id,name']); // Load relationships for response

            return response()->json([
                'message' => 'Utilisateur créé avec Succès.',
                'user' => $user
            ], 201);

        } catch (Exception $e) {
            Log::error('Failed to create user: ' . $e->getMessage());
            return response()->json(['message' => 'Erreur lors de la création de l\'utilisateur.'], 500);
        }
    }

    /**
     * Display the specified resource.
     * GET /users/{user}
     * Used by UserForm when editing
     */
    public function show(User $user)
    {
        // Authorization is handled by route middleware
        try {
            // Load relationships including roles
            $user->loadMissing(['fonctionnaire', 'roles:id,name']);
            // Return the user data directly (frontend expects { user: data }?)
            // Let's return the user model directly for simplicity with loadMissing
             return response()->json($user, 200); // Sending user model directly

        } catch (Exception $e) {
            Log::error("Error fetching user {$user->id}: " . $e->getMessage());
            return response()->json(['message' => 'Utilisateur non trouvé ou erreur serveur.'], 404);
        }
    }

    /**
     * Update the specified resource in storage.
     * PUT/PATCH /users/{user}
     */
    public function update(Request $request, User $user)
    {
        // Authorization is handled by route middleware

        // --- Validation (Added 'role') ---
        $data = $request->validate([
            'email' => [
                'required','string','email','max:255',
                Rule::unique('users', 'email')->ignore($user->id)
            ],
            'password' => 'nullable|string|min:8', // Optional on update
            'status' => [
                'required','string', Rule::in(['active', 'inactive', 'suspended'])
            ],
            'fonctionnaire_id' => [
                'required', 'integer', Rule::exists('fonctionnaires', 'id'),
                // Rule::unique('users', 'fonctionnaire_id')->ignore($user->id) // Optional
            ],
             // --- ADDED Role Validation ---
            'role' => [
                'required', 'string',
                Rule::exists('roles', 'name')->where('guard_name', $this->guardName)
            ]
            // ---
        ]);

        try {
            $user->email = $data['email'];
            $user->fonctionnaire_id = $data['fonctionnaire_id'];
            $user->status = $data['status'];

            if (!empty($data['password'])) {
                $user->password = $data['password']; // Hashing handled by model
            }

            $user->save(); // Save basic user details first

            // --- ADDED: Sync Role ---
            // Use syncRoles to replace existing roles with the new one
            $user->syncRoles([$data['role']]);
            // ---

            $user->load(['fonctionnaire', 'roles:id,name']); // Load relationships for response

            return response()->json([
                'message' => 'Utilisateur modifié avec Succès.',
                'user' => $user
            ], 200);

        } catch (Exception $e) {
            Log::error("Failed to update user {$user->id}: " . $e->getMessage());
            return response()->json(['message' => 'Erreur lors de la modification de l\'utilisateur.'], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     * DELETE /users/{user}
     */
    public function destroy(User $user)
    {
         // Authorization is handled by route middleware

        // Prevent users from deleting themselves? (Good practice)
        if (Auth::id() == $user->id) {
           return response()->json(['message' => 'Vous ne pouvez pas supprimer votre propre compte.'], 403);
        }

       try {
           // Roles will be detached automatically by the package/database constraints if set up correctly
           $user->delete(); // Soft delete if trait is used
           return response()->json(['message' => 'Utilisateur Supprimé avec Succès.'], 200);

       } catch (Exception $e) {
            Log::error("Failed to delete user {$user->id}: " . $e->getMessage());
             // Specific check for FK constraints might not be needed if soft deleting
            return response()->json(['message' => 'Erreur lors de la suppression de l\'utilisateur.'], 500);
       }
    }
    public function getOptions(): \Illuminate\Http\JsonResponse // Correct type hint
    {
        try {
            // Use Query Builder or Eloquent with JOIN for efficiency
            $users = User::query()
                // Join the fonctionnaires table based on the foreign key relationship
                // Adjust column names 'fonctionnaire_id' and 'fonctionnaires.id' if they differ
                ->leftJoin('fonctionnaires', 'users.fonctionnaire_id', '=', 'fonctionnaires.id')
                // Select the user ID, user email (as fallback), and concatenate fonctionnaire names
                ->select(
                    'users.id',
                    'users.email',
                    'fonctionnaires.prenom AS f_prenom', // Select prenom with alias
                    'fonctionnaires.nom AS f_nom',       // Select nom with alias
                    DB::raw("CONCAT_WS(' ', fonctionnaires.prenom, fonctionnaires.nom) AS nom_complet")
                )
                // ->where('users.status', 'active') // Optional: Filter users by status if needed
                ->orderBy('nom_complet', 'asc')    // Order by the calculated full name
                ->get();

            // Format for react-select { value: user_id, label: 'Nom Complet (or Email)' }
            $options = $users->map(function ($user) {
                // Use the calculated nom_complet; if it's empty or null, fallback to email
                $label = $user->f_prenom.' '.$user->f_nom;
                return [
                    'value' => $user->id,
                    'label' =>  $label  // Use name if not empty, else email
                ];
            });

            return response()->json($options);

        } catch (\Exception $e) {
            Log::error('Error fetching user options for dropdown: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString() // Log trace for debugging
            ]);
            return response()->json(['message' => 'Erreur serveur lors de la récupération des utilisateurs.'], 500);
        }
    }
}