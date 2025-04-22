// src/gestion_conventions/appel_offres_views/AppelOffreVisualisation.jsx

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios'; // Needed for fetching data
import { Spinner, Alert, Badge, Button, Row, Col } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faToggleOn, faToggleOff, faInfoCircle,
    faCalendarAlt, faTimes, faTag, faMoneyBillWave, faClock
} from '@fortawesome/free-solid-svg-icons';
import '../marches_views/marche.css'; // Reuse styling if applicable

// --- Helpers (Consider moving to a shared utils file) ---
const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        const datePart = dateString.split(' ')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) { return dateString; }
        return new Date(datePart + 'T00:00:00Z').toLocaleDateString('fr-CA'); // YYYY-MM-DD
    } catch (e) { console.error("Date format error:", dateString, e); return dateString; }
};

const formatCurrency = (value) => {
    if (value == null || value === '' || isNaN(Number(value))) return '-';
    try {
        return parseFloat(value).toLocaleString('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 });
    } catch (e) { console.error("Currency format error:", value, e); return String(value); }
};

const renderBooleanStatus = (value, trueIcon = faToggleOn, falseIcon = faToggleOff, trueText = "Oui", falseText = "Non", trueVariant = "success", falseVariant = "secondary") => {
    if (value === null || value === undefined) return '-';
    return value ?
        <Badge bg={trueVariant} text="white"><FontAwesomeIcon icon={trueIcon} /> {trueText}</Badge> :
        <Badge bg={falseVariant} text="white"><FontAwesomeIcon icon={falseIcon} /> {falseText}</Badge>;
};
// --- End Helpers ---

const AppelOffreVisualisation = ({ itemId, onClose, baseApiUrl }) => {
    const [appelOffreData, setAppelOffreData] = useState(null);
    const [provinceName, setProvinceName] = useState(null); // State for Province Name
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;
        if (!itemId) {
            setLoading(false);
            setError("ID de l'Appel d'Offre manquant.");
            return;
        }

        const fetchDetails = async () => {
            setLoading(true);
            setError(null);
            setAppelOffreData(null);
            setProvinceName(null);
            console.log(`Visualisation AO: Fetching details for ID: ${itemId}`);

            try {
                // 1. Fetch main Appel d'Offre data
                const aoRes = await axios.get(`${baseApiUrl}/appel-offres/${itemId}`);
                if (!isMounted) return;

                // ** Adapt based on your API response structure **
                const fetchedData = aoRes.data?.appel_offre || aoRes.data || null;
                setAppelOffreData(fetchedData);
                console.log(`Visualisation AO: Fetched data`, fetchedData);

                // 2. Fetch Province name if ID exists
                if (fetchedData && fetchedData.province_id) {
                    console.log(`Visualisation AO: Fetching province details for ID: ${fetchedData.province_id}`);
                    try {
                         // ** Adapt endpoint and response structure **
                         const provinceRes = await axios.get(`${baseApiUrl}/provinces/${fetchedData.province_id}`);
                         if (isMounted) {
                             // ** Adjust field name ('Description') based on your Province API response **
                             const name = provinceRes.data?.province?.Description || provinceRes.data?.Description || `(ID: ${fetchedData.province_id})`;
                             setProvinceName(name);
                             console.log(`Visualisation AO: Set province name: ${name}`);
                         }
                    } catch (provinceErr) {
                        if (isMounted) {
                            console.error(`Error fetching province details (ID: ${fetchedData.province_id}):`, provinceErr.response || provinceErr);
                            setProvinceName(`(Erreur chargement Province ID: ${fetchedData.province_id})`);
                        }
                    }
                } else {
                     if (isMounted) setProvinceName(null); // No province linked
                }

            } catch (err) {
                if (!isMounted) return;
                console.error("Error fetching Appel d'Offre visualisation data:", err.response || err);
                setError(err.response?.data?.message || err.message || "Erreur lors du chargement des détails.");
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchDetails();
        return () => { isMounted = false; }; // Cleanup function
    }, [itemId, baseApiUrl]); // Rerun if itemId or baseApiUrl changes

    // Helper to render detail fields conditionally
    const renderDetail = (label, value, formatter = null, mdSize = 6, lgSize = 4, icon = null) => (
         (value !== null && value !== undefined && value !== '') || value === 0 ?
            <Col xs={12} md={mdSize} lg={lgSize} className="mb-3 data-point">
                <strong className="text-dark titly d-block label">
                    {icon && <FontAwesomeIcon icon={icon} className="me-2 text-warning" />}
                    {label}
                </strong>
                <span className="value">{formatter ? formatter(value) : value}</span>
            </Col>
        : null // Render nothing if value is null/undefined/empty string (but allow 0)
    );

    // --- Render Logic ---
    if (loading) {
       return <div className="text-center p-5"><Spinner animation="border" /><span> Chargement des détails...</span></div>;
    }
    if (error) { return <Alert variant="danger" className="m-3">Erreur: {error}</Alert>; }
    if (!appelOffreData) { return <Alert variant="warning" className="m-3">Aucune donnée trouvée pour cet appel d'offre.</Alert>; }

    // Main content render
    return (
        <div className='px-4'> {/* Add padding */}
            {/* Header Section */}
             <div className="d-flex justify-content-between align-items-start mb-4 px-5 pt-5 border-bottom holder pb-1">
                 <div>
                     <h5 className="text-uppercase fw-bold text-secondary mb-1">Détails</h5>
                     <h2 className="mb-1 fw-bold text-dark">Appel d'Offre : {appelOffreData.numero}</h2>
                 </div>
                 {onClose && (
                     <Button variant="warning" onClick={onClose} title="Fermer" className="px-5 border-0 rounded-5 shadow-sm ">
                          <b>Revenir a la liste</b>
                     </Button>
                 )}
             </div>

             <div className="px-5 pb-3 holder"> {/* Content Padding */}
                 {/* Intitule */}
                 <Row className="mb-4 pb-3 border-bottom data-section">
                     <Col xs={12} className="mb-3 data-point text-center pill bg-light shadow-sm p-3 rounded-pill">
                         <strong className="text-dark titly fs-bold d-block label">Intitulé</strong>
                         <p className="value lead mb-0">{appelOffreData.intitule || '-'}</p>
                     </Col>
                 </Row>

                 {/* Main Details Grid */}
                 <h5 className="mb-3 section-title text-uppercase fw-bold text-secondary">Informations Clés</h5>
                 <Row className="mb-4 pb-3 border-bottom data-section">
                     {renderDetail("Catégorie", appelOffreData.categorie, null, 6, 4, faTag)}
                     {renderDetail("Province", provinceName, null, 6, 4, faBuilding)}
                     {renderDetail("Estimation TTC", appelOffreData.estimation, formatCurrency, 6, 4, faMoneyBillWave)}
                     {renderDetail("Estimation HT", appelOffreData.estimation_HT, formatCurrency, 6, 4, faMoneyBillWave)}
                     {renderDetail("Montant TVA", appelOffreData.montant_TVA, formatCurrency, 6, 4, faMoneyBillWave)}
                     {renderDetail("Durée Exécution (jours)", appelOffreData.duree_execution, null, 6, 4, faClock)}
                 </Row>

                 <h5 className="mb-3 section-title text-uppercase fw-bold text-secondary">Dates Importantes</h5>
                 <Row className="mb-4 pb-3 border-bottom data-section">
                     {renderDetail("Date Vérification", appelOffreData.date_verification, formatDate, 6, 3, faCalendarAlt)}
                     {renderDetail("Date Ouverture Plis", appelOffreData.date_ouverture, formatDate, 6, 3, faCalendarAlt)}
                     {renderDetail("Dernière Session OP", appelOffreData.last_session_op, formatDate, 6, 3, faCalendarAlt)}
                 </Row>

                 <h5 className="mb-3 section-title text-uppercase fw-bold text-secondary">Statut Portail</h5>
                 <Row className="mb-3 data-section">
                      {renderDetail("Lancé sur Portail Achat Public", appelOffreData.lancement_portail, renderBooleanStatus, 6, 4)}
                      {/* Only show date lancement if it was launched */}
                      {appelOffreData.lancement_portail && renderDetail("Date Lancement Portail", appelOffreData.date_lancement_portail, formatDate, 6, 4, faCalendarAlt)}
                 </Row>

                 {/* Optional: Display Timestamps if needed
                 <h5 className="mb-3 section-title">Historique</h5>
                 <Row>
                     {renderDetail("Créé le", appelOffreData.created_at, (ts) => new Date(ts).toLocaleString('fr-CA'))}
                     {renderDetail("Modifié le", appelOffreData.updated_at, (ts) => new Date(ts).toLocaleString('fr-CA'))}
                 </Row>
                 */}
             </div>
        </div>
    );
};

// --- PropTypes ---
AppelOffreVisualisation.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    onClose: PropTypes.func, // Optional close function
    baseApiUrl: PropTypes.string.isRequired,
};

export default AppelOffreVisualisation;