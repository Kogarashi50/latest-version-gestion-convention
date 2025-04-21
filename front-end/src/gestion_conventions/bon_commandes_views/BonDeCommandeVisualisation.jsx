import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // Import axios
import PropTypes from 'prop-types';
// Import necessary Bootstrap components (NO Modal here)
import { Button, Row, Col, Badge, ListGroup, Spinner, Alert } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faFileAlt, faTimes, faBuilding, faCalendarAlt, faFileInvoiceDollar, faTag, faFileContract, faClipboardCheck, faMoneyBillWave, faInfoCircle, faClock, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import './boncmd.css'
// --- Environment Variables ---
const BASE_API_URL = 'http://192.168.30.241:81/api';
const STORAGE_URL =  'http://192.168.30.241:81/storage';

// --- Helper Functions (Define or Import) ---
const formatDecimal = (value, currency = '', decimals = 2) => {
    const number = parseFloat(value);
    if (isNaN(number) || value === null || value === undefined) return '-';
    const formatted = number.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return currency ? `${formatted} ${currency}` : formatted;
};

const formatDateSimple = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
             console.warn("Visualisation: Invalid date received:", dateString);
             return dateString;
        }
        return date.toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) {
        console.error("Visualisation: Error formatting date:", dateString, e);
        return dateString;
    }
};

const displayData = (data, fallback = '-') => data ?? fallback;

// Helper to determine badge color based on state
const getEtatBadgeVariant = (etat) => {
     switch (etat?.toLowerCase()) {
        case 'en préparation': return 'primary';
        case 'validé': return 'info';
        case 'envoyé': return 'warning';
        case 'reçu': return 'success';
        case 'annulé': return 'danger';
        default: return 'secondary';
     }
 };
// --- End Helpers ---


// --- Component Definition ---
// Receives itemId. 'show' prop is not strictly needed by this component's internal logic
// if DynamicTable controls the rendering. 'onClose' can be used for an optional internal close button.
const BonDeCommandeVisualisation = ({ itemId, onClose, baseApiUrl = BASE_API_URL }) => { // Default baseApiUrl

    // State for fetched data, loading, and error within this component
    const [bonCommandeData, setBonCommandeData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- Fetching Logic ---
    const fetchData = useCallback(async () => {
        // Fetch only if itemId is valid (truthy)
        if (!itemId) {
            // Reset state if itemId becomes invalid (e.g., modal closed in parent)
            setBonCommandeData(null);
            setLoading(false);
            setError(null);
            return;
        }

        console.log(`[BC Visualisation Content] Fetching data for Bon de Commande ID: ${itemId}`);
        setLoading(true);
        setError(null);
        setBonCommandeData(null); // Clear previous data while loading

        try {
            // Fetch the specific Bon de Commande - Ensure backend eager loads relationships
            const response = await axios.get(`${baseApiUrl}/bon-de-commande/${itemId}`, { withCredentials: true });
            const bcData = response.data.bon_de_commande || response.data; // Adjust key if needed

            if (bcData && typeof bcData === 'object' && Object.keys(bcData).length > 0) {
                 // Ensure relationships exist or default them to prevent errors later
                 bcData.fichiers = Array.isArray(bcData.fichiers) ? bcData.fichiers : [];
                 // Use the correct key from your backend response for the market
                 bcData.marche_public = bcData.marche_public || null;
                 bcData.contrat = bcData.contrat || null;

                 setBonCommandeData(bcData);
                 console.log("[BC Visualisation Content] Bon de Commande Data Received:", bcData);
            } else {
                // Set error if data received is empty/invalid
                throw new Error(`Aucune donnée ou format invalide reçu pour le bon de commande ID ${itemId}.`);
            }
        } catch (err) {
            console.error(`[BC Visualisation Content] API Error fetching data for ID ${itemId}:`, err.response || err);
            const errorMsg = err.response?.data?.message || err.response?.data?.failed || err.response?.statusText || err.message || `Erreur de chargement (ID: ${itemId}).`;
            setError(errorMsg + (err.response ? ` (Status: ${err.response.status})` : ''));
            setBonCommandeData(null); // Clear data on error
        } finally {
            setLoading(false);
        }
    // Include baseApiUrl in dependencies if it can change
    }, [itemId, baseApiUrl]);

    // Effect to trigger fetch when itemId changes
    useEffect(() => {
        fetchData();
    }, [fetchData]); // fetchData includes itemId in its dependency array


    // --- Render Logic ---

    // Helper to render fields consistently
    const renderField = (label, value, icon = null, className = "mb-3", isBadge = false) => (
        <div className={className}>
             <p className="text-dark d-flex justify-content-between titly d-block mb-1">
                <b> {icon && <FontAwesomeIcon icon={icon} className="me-2 text-warning" />}
                 <span>{label}</span></b>
           
             {isBadge ? (
                 <Badge bg={getEtatBadgeVariant(value)} text={['warning', 'light', 'info'].includes(getEtatBadgeVariant(value)) ? 'dark' : 'white'} className="py-1 px-2" style={{fontSize: '0.85rem'}} >
                    {displayData(value)}
                 </Badge>
             ) : (
                 <span className="fs-6">{displayData(value)}</span>
             )} 
              </p>
        </div>
    );
    const renderField2 = (label, value) => (
        <div className='border shadow-sm my-5 rounded-5 justify-content-center align-items-center d-flex flex-column py-3 bg-white'>
             <p className="text-dark titly">
                <b> 
                 <span>{label}</span></b>
           
              </p>
              <p className="fs-6">{displayData(value)}</p>

        </div>
    );

    // --- Loading State ---
    if (loading) {
        return (
             <div className="text-center p-4"> {/* Render loader directly */}
                 <Spinner animation="border" variant="primary" />
                 <p className="mt-2 text-muted">Chargement...</p>
            </div>
        );
    }

    // --- Error State ---
    if (error) {
         return (
             <Alert variant="danger" className="m-3"> {/* Render error directly */}
                 <FontAwesomeIcon icon={faExclamationTriangle} className="me-2"/> {error}
                 {/* Optional close button within the content */}
                 {/* <Button variant="link" className="btn-close float-end" onClick={onClose}></Button> */}
            </Alert>
         );
     }

    // --- No Data State ---
    if (!bonCommandeData) {
         // This renders if itemId is initially null or fetch failed silently
         return (
            <div className="text-center p-4">
                 <p className="mt-2 text-muted">Aucune donnée à afficher.</p>
            </div>
         );
     }

   
 

    
    // --- Main Content Rendering (No surrounding Modal tags) ---
    return (
        // Add container class and padding
        <div className="py-3 px-5 bc-visualisation-container holder">
             {/* Optional Header within the content (if needed) */}
             <div className="d-flex p-3 justify-content-between  align-items-start mb-4 px-5 border-bottom holder pb-1">
                <h2 className='mb-1 fw-bold text-dark  '>
                    Bon de Commande: <span>{bonCommandeData.numero_bc}</span>
                </h2>
                  {onClose && (
                                     <Button variant="warning"  onClick={onClose} title="Fermer" className="px-5 border-0 rounded-5 shadow-sm ">
                                         <b>Revenir a la liste</b>
                                     </Button>
                                 )}
                
             </div>

            <Row className='mt-5 '>
                {/* --- Main Details --- */}
                <Col md={5} className='border mx-5 rounded-5 shadow-sm p-5 bg-white'>
                    {renderField("Fournisseur", bonCommandeData.fournisseur_nom, faBuilding)}
                    {renderField("Date Émission", formatDateSimple(bonCommandeData.date_emission), faCalendarAlt)}
                    {renderField("Montant Total TTC", formatDecimal(bonCommandeData.montant_total, 'DH'), faMoneyBillWave)}
                    {renderField("État", bonCommandeData.etat, faInfoCircle, "mb-3 bc-data-point", true)} {/* Added class */}
                </Col>
                {/* --- Associations & Payment --- */}
                <Col md={5}  className='border mx-5 rounded-5 shadow-sm p-5 bg-white'>
                    {renderField("Mode Paiement", bonCommandeData.mode_paiement, faTag)}
                    {renderField(
                        "Marché Associé",
                        bonCommandeData.marche_public ? `${bonCommandeData.marche_public.numero_marche || bonCommandeData.marche_public.intitule || `ID: ${bonCommandeData.marche_public.id}`}` : '-',
                        faClipboardCheck
                    )}
                    {renderField(
                        "Contrat Associé",
                        bonCommandeData.contrat ? `${bonCommandeData.contrat.numero_contrat || bonCommandeData.contrat.objet || `ID: ${bonCommandeData.contrat.id}`}` : '-',
                        faFileContract
                    )}
                    {renderField("Créé le", formatDateSimple(bonCommandeData.created_at), faClock)}
                </Col>
            <Col xs={1}></Col>
                 <Col xs={10}>
                    {/* Use renderField for consistency */}
                     {renderField2("Objet du Bon de Commande", bonCommandeData.objet, null, "mb-0 bc-data-point")} {/* Added class */}
                 </Col>
                 <Col xs={1}></Col>

            </Row>

            {/* --- Fichiers Section --- */}
            {Array.isArray(bonCommandeData.fichiers) && bonCommandeData.fichiers.length > 0 ? (
                <Row className=" pt-3 border-top"> {/* Added mt-3 */}
                    <Col xs={12}>
                        {/* Apply section title class */}
                        <strong className=" d-block  ">
                         <p className="text-uppercase titly text-muted fs-4">Fichiers Associés ({bonCommandeData.fichiers.length})</p>  
                       </strong>
                        {/* Apply files list class */}
                        <ListGroup variant="" className=" d-flex justify-content-evenly flex-wrap flex-row align-items-center p-2 ">
                            {bonCommandeData.fichiers.map(file => (
                                file && file.id ? (
                                    <ListGroup.Item key={file.id} className="border rounded-4 p-2 d-flex align-items-center bg-dark  m-1 text-white">
                                                                   <FontAwesomeIcon icon={faFileAlt} className='me-2 text-warning'/>
                                                                   <span className="text-truncate" title={file.nom_fichier || 'Nom inconnu'}>
                                            {file.nom_fichier || 'Fichier sans nom'}
                                        </span>
                                        {file.chemin_fichier && (
                                            <a href={`${STORAGE_URL}/${file.chemin_fichier}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-warning ms-2" title="Voir / Télécharger" > <FontAwesomeIcon icon={faDownload} /> </a>
                                        )}
                                    </ListGroup.Item>
                                ) : null
                            ))}
                        </ListGroup>
                    </Col>
                </Row>
            ) : (
               // Show placeholder if no files
               <Row className="mt-3 pt-3 border-top"> {/* Added mt-3 */}
                   <Col><p className="text-muted fst-italic small">Aucun fichier associé.</p></Col>
               </Row>
            )}

             {/* Optional Close Button */}
             {/* <Row className="mt-4 pt-3 border-top">
                 <Col className="text-end">
                     <Button variant="outline-secondary" size="sm" onClick={onClose}>
                          <FontAwesomeIcon icon={faTimes} className="me-2" /> Fermer
                     </Button>
                 </Col>
             </Row> */}
        </div>
    );
};

// --- PropTypes Update ---
BonDeCommandeVisualisation.propTypes = {
    // 'show' is used by the parent modal, but not directly needed here if parent controls rendering
    // show: PropTypes.bool,
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // ID is essential for fetching
    onClose: PropTypes.func.isRequired, // Needed for potential internal close button or if parent passes it
    baseApiUrl: PropTypes.string // Optional if BASE_API_URL is globally defined or defaulted
};

// Default props if needed
// BonDeCommandeVisualisation.defaultProps = {
//    baseApiUrl: BASE_API_URL // Set default if not passed as prop
// };

export default BonDeCommandeVisualisation;