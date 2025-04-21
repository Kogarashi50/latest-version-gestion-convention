// src/gestion_conventions/Login.js
import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css'

// *** CHANGE: Pass received user data via onLogin ***
export default function Login({ onLogin }) {
    // *** CHANGE: State for email ***
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    async function validateForm(e) {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        
        try {
            // *** CHANGE: Send email instead of username ***
            const response = await axios.post('/login', {
                email: email,
                password: password,
            });

            // 3. Handle SUCCESS
            const receivedToken = response.data.token;
            const receivedUserData = response.data.user; // User object (id, email, status, etc.)

            // *** CHANGE: Simplified onLogin call - pass token and user data ***
            if (receivedToken && receivedUserData && typeof onLogin === 'function') {
                onLogin(receivedToken, receivedUserData); // Pass both
                navigate('/'); // Navigate AFTER successful login processing in parent
            } else {
                 console.error("Login response missing token or user data.");
                 setError("Erreur de connexion: Réponse invalide du serveur.");
                 // Manually clear potentially problematic local storage if needed
                 localStorage.removeItem('authToken');
                 localStorage.removeItem('user');
                 localStorage.setItem('isLoggedIn', 'false');
            }

        } catch (err) {
            // --- ERROR HANDLING ---
            let errorMessage = 'Une erreur inattendue est survenue. Veuillez réessayer.';
            if (err.response) {
                console.error("Login Error Response:", err.response);
                const status = err.response.status;
                const data = err.response.data;

                // *** CHANGE: Handle validation errors potentially for 'email' field ***
                 if (status === 422 && data && data.errors) {
                    // Check for email or password errors specifically
                    if (data.errors.email) {
                         errorMessage = data.errors.email[0];
                    } else if (data.errors.password) {
                         errorMessage = data.errors.password[0]; // Likely "credentials incorrect"
                    } else {
                        // Generic fallback for other validation errors
                        const firstErrorKey = Object.keys(data.errors)[0];
                        errorMessage = data.errors[firstErrorKey][0];
                    }
                } else if (status === 403 && data?.message) { // Handle specific forbidden message (e.g., inactive user)
                    errorMessage = data.message;
                } else if (status === 401 && data?.message) { // Generic unauthorized
                     errorMessage = data.message;
                } else {
                    errorMessage = data?.message || `Erreur serveur (${status}).`;
                }
            } else if (err.request) {
                errorMessage = "Aucune réponse du serveur. Vérifiez votre connexion.";
            } else {
                errorMessage = err.message;
            }
            setError(errorMessage);
            // --- END ERROR HANDLING ---

        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="container d-flex justify-content-center align-items-center w-100 min-vh-100 ">
            <div className="loginZone d-flex justify-content-end w-75 m-5">
                <div className="d-flex logoZone flex-column justify-content-center p-5 align-items-center">
                    <h1 className='text-center'>GICOPMA<small className='text-light' style={{display:'flex',fontSize:'14px',padding:'5px'}}> GESTION INTEGREE DES CONVENTIONS, PROJETS ET MARCHES</small></h1>
                    {/* Added alt attribute for accessibility */}
                    <img src="./logo2.png" width='230px' alt="Logo CRO"/>
                </div>
                <form className="formZone h-100 flex-column d-flex justify-content-center align-items-center " onSubmit={validateForm}>
                    <div className=" container d-flex justify-content-center flex-column align-items-center ">
                        <h1>Connexion</h1>

                        {/* *** CHANGE: Label and input for Email *** */}
                        <label className="label align-self-start">Email</label>
                        <input
                            type="email" // Use email type for potential browser validation
                            className="input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                            required // Add basic required validation
                         />

                        <label className="label align-self-start">Mot de passe</label>
                        <input
                            type="password"
                            className="input "
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            required
                        />

                        {/* Error Message Display */}
                        {error && (
                            <div style={{ color: 'red', width: '100%', textAlign: 'center', fontSize: '11px', marginTop: '5px' }}>
                                {error}
                            </div>
                        )}

                    </div>
                    {/* ... (Remember me / Forgot password remains the same - implement functionality separately) ... */}
                    {/* ... (Submit button remains the same) ... */}
                       <button className="submit" type="submit" disabled={isLoading}>
                        {isLoading ? 'Connexion...' : 'Se connecter'}
                    </button>
                </form>
            </div>
        </div>
    );
}