// src/App.js
import './App.css';
import React, { useEffect, useState, useCallback } from 'react'; // Added useCallback
import axios from 'axios'; // Using global axios instance
import Login from './gestion_conventions/Login';
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom'; // Added useNavigate
import Sidebar from './gestion_conventions/components/sideBar';
import DashBoard from './gestion_conventions/components/dashboard'; // Corrected component name if needed
import Header from './gestion_conventions/components/headers';
import { Spinner } from 'react-bootstrap';

// --- Import Page Components (Existing from App.js 1) ---
import ConventionsPage from './gestion_conventions/conventions_views/ConventionsPage';
import PartenairesPage from './gestion_conventions/partenaires_views/PartenairesPage';
import DomainesPage from './gestion_conventions/domaines_views/DomainesPage';
import CommunesPage from './gestion_conventions/communes_views/CommunesPage';
import UsersPage from './gestion_conventions/users_views/UsersPage'; // Kept this one
import ChantiersPage from './gestion_conventions/chantiers_views/ChantiersPage';
import ProvincesPage from './gestion_conventions/provinces_views/ProvincesPage';
import ProgrammesPage from './gestion_conventions/programmes_views/ProgrammesPage';
import SousProjetsPage from './gestion_conventions/sousprojets_views/SousProjetsPage';
import ProjetsPage from './gestion_conventions/projects_views/ProjectsPage';
import MarchePublicPage from './gestion_conventions/marches_views/MarchePublicPage';
import BonDeCommandePage from './gestion_conventions/bon_commandes_views/BonDeCommandePage';
import ContratDroitCommunPage from './gestion_conventions/contrat_droit_commun/ContratDroitCommunPage';
import AvenantsPage from './gestion_conventions/avenants_views/AvenantsPage';
import VersementPage from './gestion_conventions/versements_views/VersementPage'; // This might be VersementCP
import RolesPage from './gestion_conventions/roles_views/RolesPage';
import EngagementsPage from './gestion_conventions/engagements_views/EngagementsPage';

// --- Import Page Components (Added from App.js 2) ---
import VersementsPPPage from './gestion_conventions/versementspp_views/VersementppPage';
import PartnerSummaryPage from './gestion_conventions/partenaire_sum_views/PartnerSummaryPage';
import OrdreServicePage from './gestion_conventions/ordreservice_views/OrdreServicePage';
import WelcomePage from './gestion_conventions/components/welcomePage';


// --- Axios Configuration (Keep from App.js 1) ---
axios.defaults.baseURL = 'http://localhost:8000/api';
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
// axios.defaults.withCredentials = true; // Uncomment if using Sanctum cookie auth

// --- REQUEST Interceptor (Keep from App.js 1) ---
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else {
        delete config.headers.Authorization;
    }
    return config;
}, error => {
    console.error("Axios request setup error:", error);
    return Promise.reject(error);
});

// --- RESPONSE Interceptor (Keep from App.js 1) ---
let globalLogoutHandler = () => {
    console.error("Logout handler not initialized");
};

axios.interceptors.response.use(response => {
    return response;
}, error => {
    console.error("Axios response error. Status:", error.response?.status, "URL:", error.config?.url);
    if (error.response) {
        if (error.response.status === 401) {
            if (error.config?.url !== '/user' || localStorage.getItem('isLoggedIn') === 'true') {
                 console.warn("Received 401 Unauthorized. Triggering logout.");
                 globalLogoutHandler();
            } else {
                 console.log("Initial /user check failed with 401, likely no valid token.");
            }
        } else if (error.response.status === 403) {
            console.warn("Received 403 Forbidden. User lacks permission for:", error.config?.url);
            // alert("Accès refusé. Vous n'avez pas les permissions nécessaires.");
        } else if (error.response.status === 404) {
             console.warn("Received 404 Not Found for:", error.config?.url);
        } else if (error.response.status >= 500) {
             console.error("Server error:", error.response.status, error.response.data);
             // alert("Une erreur serveur est survenue. Veuillez réessayer plus tard.");
         }
    } else if (error.request) {
        console.error('Axios error: No response received.', error.request);
        // alert("Erreur réseau ou problème de connexion au serveur.");
    } else {
        console.error('Axios error: Request setup failed.', error.message);
    }
    return Promise.reject(error);
});
// --- End Axios Configuration ---


// --- Main Application Content Component (Keep from App.js 1) ---
function AppContent() {
    const navigate = useNavigate();
    const location = useLocation();

    const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('user') || 'null');
        } catch (e) {
            console.error("Error parsing user from localStorage", e);
            localStorage.removeItem('user');
            return null;
        }
    });
    const [isLoadingUser, setIsLoadingUser] = useState(() => localStorage.getItem('isLoggedIn') === 'true' && !localStorage.getItem('user'));

    // Define the logout logic (Keep from App.js 1)
    const performLogout = useCallback(() => {
         console.log("Executing performLogout...");
         localStorage.removeItem('authToken');
         localStorage.removeItem('user');
         localStorage.setItem('isLoggedIn', 'false');
         setCurrentUser(null);
         setIsAuthenticated(false);
         if (location.pathname !== '/login') {
              navigate('/login', { replace: true });
         }
    }, [navigate, location.pathname]);

    // Assign the logout function to the global handler (Keep from App.js 1)
    useEffect(() => {
        globalLogoutHandler = performLogout;
        return () => { globalLogoutHandler = () => console.error("Logout handler not initialized"); };
    }, [performLogout]);


    // Effect to check authentication and fetch user data (Keep from App.js 1)
    useEffect(() => {
        let isMounted = true;
        const checkAuthAndFetchUser = async () => {
            const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
            const token = localStorage.getItem('authToken');
            if (loggedIn && token) {
                setIsAuthenticated(true);
                 if (!currentUser) { setIsLoadingUser(true); }
                console.log("Attempting to fetch /user...");
                try {
                    const response = await axios.get('/user');
                    if (isMounted) {
                        const freshUserData = response.data;
                        if (JSON.stringify(freshUserData) !== JSON.stringify(currentUser)) {
                            console.log("Updating user state with fresh data:", freshUserData);
                            setCurrentUser(freshUserData);
                            localStorage.setItem('user', JSON.stringify(freshUserData));
                        }
                    }
                } catch (error) {
                    console.error("Error caught in checkAuthAndFetchUser for /user:", error.message);
                } finally {
                     if (isMounted) setIsLoadingUser(false);
                }
            } else {
                if (isMounted) {
                     if (isAuthenticated || currentUser) {
                        performLogout();
                     } else {
                         setIsLoadingUser(false);
                     }
                }
            }
        };
        checkAuthAndFetchUser();

        // Storage Event Listener (Keep from App.js 1)
        const handleStorageChange = (event) => {
            if (event.key === 'isLoggedIn' || event.key === 'authToken' || event.key === 'user') {
                console.log("Storage changed:", event.key);
                 const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
                 const token = localStorage.getItem('authToken');
                 if (isMounted) {
                     if (!loggedIn || !token) {
                         if (isAuthenticated) { performLogout(); }
                     } else {
                         setIsAuthenticated(true);
                         const storedUser = localStorage.getItem('user');
                         try {
                             const parsedUser = storedUser ? JSON.parse(storedUser) : null;
                             if (JSON.stringify(parsedUser) !== JSON.stringify(currentUser)) {
                                 setCurrentUser(parsedUser);
                                 if (!parsedUser) { checkAuthAndFetchUser(); }
                             }
                         } catch (e) {
                             console.error("Error parsing user from storage event", e);
                             performLogout();
                         }
                     }
                 }
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            isMounted = false;
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [performLogout, isAuthenticated]);

    // Login handler (Keep from App.js 1)
    const handleLogin = useCallback((receivedToken, receivedUserData) => {
        console.log("Handling login...");
        localStorage.setItem('authToken', receivedToken);
        localStorage.setItem('user', JSON.stringify(receivedUserData));
        localStorage.setItem('isLoggedIn', 'true');
        setIsAuthenticated(true);
        setCurrentUser(receivedUserData);
        setIsLoadingUser(false);
        navigate('/', { replace: true });
    }, [navigate]);

    // Prepare conditional rendering variables
    const showLayout = isAuthenticated && location.pathname !== '/login';
    const isLoginPage = location.pathname.toLowerCase() === '/login';

    // Loading State (Keep from App.js 1)
    if (isLoadingUser && isAuthenticated && !isLoginPage) {
         return (
             <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                 <Spinner animation="border" variant="primary" /> <span className='ms-3'>Chargement des données utilisateur...</span>
             </div>
         );
    }

    // --- Render App ---
    return (
        <div style={{ display: 'flex' }} className={isLoginPage ? 'app-login-background' : ''}>
            {showLayout && <Sidebar currentUser={currentUser} />}

            <main className="main-content d-flex flex-column" style={{ backgroundColor: isLoginPage ? 'transparent' : undefined }}>
                 {showLayout && <Header onLogout={performLogout} currentUser={currentUser} />}

                {/* --- Routes --- */}
                <Routes>
                    {/* Login Route */}
                    <Route
                        path="/login"
                        element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" replace />}
                    />

                    {/* Protected Routes - Render only if authenticated */}
                    <Route path="/" element={isAuthenticated ? <WelcomePage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/convention' element={isAuthenticated ? <ConventionsPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/avenants' element={isAuthenticated ? <AvenantsPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/versements' element={isAuthenticated ? <VersementPage currentUser={currentUser} /> : <Navigate to="/login" replace />} /> {/* This might be VersementCP */}
                    <Route path='/partenaire' element={isAuthenticated ? <PartenairesPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/chantier' element={isAuthenticated ? <ChantiersPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/programme' element={isAuthenticated ? <ProgrammesPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/domaine' element={isAuthenticated ? <DomainesPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/projet' element={isAuthenticated ? <ProjetsPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/sousprojet' element={isAuthenticated ? <SousProjetsPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/commune' element={isAuthenticated ? <CommunesPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/province' element={isAuthenticated ? <ProvincesPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/marche' element={isAuthenticated ? <MarchePublicPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/marches/bonCommandes' element={isAuthenticated ? <BonDeCommandePage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/marches/contratsDroitCommun' element={isAuthenticated ? <ContratDroitCommunPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/engagements' element={isAuthenticated ? <EngagementsPage currentUser={currentUser}/> : <Navigate to="/login" replace />} />
                    <Route path='/users' element={isAuthenticated ? <UsersPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/roles' element={isAuthenticated ? <RolesPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />

                    {/* --- Added Routes from App.js 2 --- */}
                    <Route path='/versementpp' element={isAuthenticated ? <VersementsPPPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/finance/partner-summary' element={isAuthenticated ? <PartnerSummaryPage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    <Route path='/ordres-service' element={isAuthenticated ? <OrdreServicePage currentUser={currentUser} /> : <Navigate to="/login" replace />} />
                    {/* --- End Added Routes --- */}


                    {/* Catch-all Route */}
                    <Route
                        path="*"
                        element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />}
                    />
                </Routes>
            </main>
        </div>
    );
}

// --- Root Application Component (Keep from App.js 1) ---
function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}

export default App;