// src/gestion_conventions/appel_offres_views/AppelOffreVisualisation.jsx

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Spinner, Alert, Badge, Button, Row, Col } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faToggleOn, faToggleOff, faInfoCircle,
    faCalendarAlt, faTimes, faTag, faMoneyBillWave, faClock, faMapMarkedAlt
} from '@fortawesome/free-solid-svg-icons';
// Assuming styling is shared or adjust path as needed
import '../marches_views/marche.css';

// --- Helpers (Consider moving to a shared utils file) ---
const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        const datePart = dateString.split(' ')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) { return dateString; }
        return new Date(datePart ).toLocaleDateString('fr-CA'); // YYYY-MM-DD
    } catch (e) { console.error("Date format error:", dateString, e); return dateString; }
};

// --- NEW: Helper to format DateTime ---



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
            console.log(`Visualisation AO: Fetching details for ID: ${itemId}`);

            try {
                // Fetch main Appel d'Offre data (includes 'provinces' array and 'date_publication')
                const aoRes = await axios.get(`${baseApiUrl}/appel-offres/${itemId}`);
                if (!isMounted) return;

                const fetchedData = aoRes.data?.appel_offre || aoRes.data || null;
                // Ensure 'provinces' is treated as an array
                if (fetchedData && fetchedData.provinces === null) {
                    fetchedData.provinces = [];
                }
                setAppelOffreData(fetchedData);
                console.log(`Visualisation AO: Fetched data`, fetchedData);

            } catch (err) {
                if (!isMounted) return;
                console.error("Error fetching Appel d'Offre visualisation data:", err.response || err);
                setError(err.response?.data?.message || err.message || "Erreur lors du chargement des détails.");
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchDetails();
        return () => { isMounted = false; };
    }, [itemId, baseApiUrl]);

    // Helper to render detail fields conditionally
    const renderDetail = (label, value, formatter = null, mdSize = 6, lgSize = 4, icon = null) => (
         (value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)) || value === 0 ?
            <Col xs={12} md={mdSize} lg={lgSize} className="mb-3 data-point">
                <strong className="text-dark titly d-block label">
                    {icon && <FontAwesomeIcon icon={icon} className="me-2 text-secondary" />}
                    {label}
                </strong>
                {label === "Province(s)" && Array.isArray(value) ? (
                    value.length > 0 ? (
                         value.map((prov, index) => (
                            <Badge key={index} pill bg="light" text="dark" className="me-1 mb-1">{prov}</Badge>
                         ))
                    ) : ( <span className="value fst-italic text-muted">-</span> )
                ) : ( <span className="value">{formatter ? formatter(value) : value}</span> )}
            </Col>
        : null
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
                     {renderDetail("Province(s)", appelOffreData.provinces, null, 6, 4, faMapMarkedAlt)}
                     {renderDetail("Estimation TTC", appelOffreData.estimation, formatCurrency, 6, 4, faMoneyBillWave)}
                     {renderDetail("Estimation HT", appelOffreData.estimation_HT, formatCurrency, 6, 4, faMoneyBillWave)}
                     {renderDetail("Montant TVA", appelOffreData.montant_TVA, formatCurrency, 6, 4, faMoneyBillWave)}
                     {renderDetail("Durée Exécution (jours)", appelOffreData.duree_execution, null, 6, 4, faClock)}
                 </Row>

                 <h5 className="mb-3 section-title text-uppercase fw-bold text-secondary">Dates Importantes</h5>
                 <Row className="mb-4 pb-3 border-bottom data-section">
                     {renderDetail("Date Publication", appelOffreData.date_publication, formatDate, 6, 3, faCalendarAlt)} {/* <-- ADDED & use formatDateTime */}
                     {renderDetail("Date Vérification", appelOffreData.date_verification, formatDate, 6, 3, faCalendarAlt)}
                     {renderDetail("Date Ouverture Plis", appelOffreData.date_ouverture, formatDate, 6, 3, faCalendarAlt)}
                     {renderDetail("Dernière Session OP", appelOffreData.last_session_op, formatDate, 6, 3, faCalendarAlt)}
                 </Row>

                 <h5 className="mb-3 section-title text-uppercase fw-bold text-secondary">Statut Portail</h5>
                 <Row className="mb-3 data-section">
                      {renderDetail("Lancé sur Portail Achat Public", appelOffreData.lancement_portail, renderBooleanStatus, 6, 4)}
                      {appelOffreData.lancement_portail && renderDetail("Date Lancement Portail", appelOffreData.date_lancement_portail, formatDate, 6, 4, faCalendarAlt)}
                 </Row>

                 {/* Message if no provinces are selected */}
                 {(!appelOffreData.provinces || appelOffreData.provinces.length === 0) && (
                    <Alert variant='secondary' className='small py-2 mt-3'>
                        <FontAwesomeIcon icon={faInfoCircle} className="me-2"/> Aucune province n'est associée à cet appel d'offre.
                    </Alert>
                 )}
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