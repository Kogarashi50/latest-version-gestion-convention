<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use App\Models\User; // ** USE THE CORRECT USER MODEL **

class LoginController extends Controller
{
    /**
     * Handle an authentication attempt for the API via Sanctum.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function login(Request $request)
    {
        // ** Validate using 'email' **
        $request->validate([
            'email'    => 'required|string|email', // Expect email
            'password' => 'required|string',
        ]);

        // ** Get credentials using 'email' **
        $credentials = $request->only('email', 'password');

        // ** Attempt authentication using the configured guard that uses the User model **
        // Typically 'web' or your configured API guard's provider works here for the initial check.
        // We primarily care about creating a Sanctum token on success.
        if (!Auth::guard('web')->attempt($credentials)) { // Or use Auth::attempt($credentials) if 'web' is default

            // ** Check if email exists using the User model **
            if (!User::where('email', $credentials['email'])->exists()) {
                 throw ValidationException::withMessages([
                    'email' => ["L'adresse e-mail fournie n'existe pas."], // Error for email
                 ]);
            }

            // Generic message for wrong password - better security
             throw ValidationException::withMessages([
                'password' => ['Les informations d\'identification fournies sont incorrectes.'],
             ]);
        }

        // --- Authentication Successful ---

        // Retrieve the authenticated user instance (now an App\Models\User)
        // Using Auth::user() is usually fine after a successful attempt, regardless of guard used for attempt
        // $user = Auth::guard('web')->user(); // Or more simply:
        $user = Auth::user();

        if (!$user) {
             // Should not happen after successful attempt, but as a safeguard
             return response()->json(['message' => 'Erreur lors de la récupération de l\'utilisateur après connexion.'], 500);
        }


        // Ensure user status allows login (Example: only 'active' users)
        // !!! ADJUST THIS LOGIC based on your 'status' field requirements !!!
        if ($user->status !== 'active') {
            // Log the user out immediately after successful credential check but invalid status
             Auth::guard('web')->logout(); // Logout from session if attempt used 'web'
             // Optionally revoke any lingering tokens if needed, though none should be active yet.
            // $user->tokens()->delete();

             return response()->json([
                'message' => 'Votre compte est inactif ou suspendu. Veuillez contacter l\'administrateur.',
                // You might want a more specific error code or message depending on the status
             ], 403); // Forbidden
        }

        // Revoke previous tokens if you want single-session login (optional)
        // $user->tokens()->delete();

        // ** Create a new Sanctum token **
        // Use user ID or email in token name for clarity (optional)
        $token = $user->createToken('api-token-'.$user->id)->plainTextToken;

        // ** Return token and essential user info (NO roles/permissions) **
        return response()->json([
            'message' => 'Connexion réussie',
            'token' => $token,
            'user' => $user
            
        ], 200);
    }

    /**
     * Log the user out (revoke the Sanctum token).
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function logout(Request $request)
    {
        // Use the authenticated user from Sanctum
        $user = $request->user(); // Gets user via Sanctum token

        if ($user) {
             // Revoke the specific token used for this request
            $user->currentAccessToken()->delete();
             return response()->json(['message' => 'Déconnexion réussie'], 200);
        }

         // If no user is authenticated via token
         return response()->json(['message' => 'Aucun utilisateur authentifié'], 401);
    }
}