// src/pages/sousprojets_views/SousProjetVisualisation.jsx

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';

// Helpers (Copy or import from a shared utility file)
const formatPercentage = (value) => { const n = parseFloat(value); return isNaN(n)?'-':`${n.toFixed(2)} %`; };
const formatNumber = (value, decimals = 2) => { const n = parseFloat(value); return isNaN(n)?'-':n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); };
const displayData = (data, fallback = '-') => data ?? fallback;
const formatDate = (dateString) => { if (!dateString) return '-'; try { return new Date(dateString).toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return dateString; } };
// const formatDateSimple = (dateString) => { if (!dateString) return '-'; try { if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) { return new Date(dateString + 'T00:00:00Z').toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' }); } const d=new Date(dateString); return isNaN(d.getTime())?dateString:d.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (e) { return dateString; } }; // If needed

// Styles/Classes (Can reuse from ProjetVisualisation or define specifically)
const VISUALISATION_CONTAINER_CLASS = "p-3 p-md-4 sousprojet-visualisation-container"; // Example class
const VISUALISATION_CLOSE_BUTTON_CLASS = 'float-end py-2 rounded-5 shadow fw-bold px-5';
const CARD_CLASS = "h-100 border-light shadow-sm";
const CARD_TITLE_CLASS = "mb-3 fw-semibold text-secondary text-uppercase small";
const DL_CLASS = "row mb-0 dl-compact";
const DT_CLASS = "col-sm-5"; // Adjust grid if needed
const DD_CLASS = "col-sm-7";

const SousProjetVisualisation = ({ itemId, onClose, baseApiUrl }) => {
    const [sousProjetData, setSousProjetData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSousProjet = useCallback(async () => {
        // itemId here is Code_Sous_Projet
        if (!itemId || !baseApiUrl) {
             setError("Configuration error: Missing ID or Base URL.");
             setLoading(false);
             return;
        }
        setLoading(true); setError(null); setSousProjetData(null);
        const fetchUrl = `${baseApiUrl}/sousprojets/${itemId}`; // Use Code_Sous_Projet in URL
        console.log("Fetching Sous-Projet from:", fetchUrl); // Debug log

        try {
            const response = await axios.get(fetchUrl, { withCredentials: true });
             // Adjust the key based on your Laravel API response structure
            const data = response.data.sousprojet || response.data.sous_projet || response.data;
            console.log("Fetched Sous-Projet Data:", data); // Debug log

            if (data && typeof data === 'object' && data.Code_Sous_Projet) {
                 // Optional: Warn if related data is missing but expected
                 if (!data.projet) console.warn(`Projet Maître data missing for Sous-Projet ${itemId}.`);
                 if (!data.province) console.warn(`Province data missing for Sous-Projet ${itemId}.`);
                 if (!data.commune) console.warn(`Commune data missing for Sous-Projet ${itemId}.`);
                setSousProjetData(data);
            } else {
                setError(`Aucune donnée trouvée pour le Sous-Projet code ${itemId}. Response structure might be unexpected.`);
                console.warn("Unexpected response structure:", response.data);
            }
        } catch (err) {
            console.error(`Error fetching Sous-Projet ${itemId}:`, err.response || err);
            const eMsg = err.response?.data?.message || err.message || 'Erreur inconnue lors du chargement.';
            setError(`${eMsg} (Code: ${itemId}, Status: ${err.response?.status})`);
        }
        finally { setLoading(false); }
    }, [itemId, baseApiUrl]);

    useEffect(() => { fetchSousProjet(); }, [fetchSousProjet]);

    // --- Render Logic ---
    if (loading) { return <div className="text-center p-5 d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}><Spinner animation="border" variant="primary" className="me-3"/><span className="text-muted">Chargement du sous-projet...</span></div>; }
    if (error) { return <Alert variant="danger" className="m-3 m-md-4"><Alert.Heading>Erreur</Alert.Heading><p>{error}</p><hr/><Button onClick={onClose} variant="outline-danger" size="sm">Fermer</Button></Alert>; }
    if (!sousProjetData) { return <Alert variant="warning" className="m-3 m-md-4">Aucune donnée disponible pour ce sous-projet (Code: {itemId}).<Button variant="link" size="sm" onClick={onClose} className="float-end">Fermer</Button></Alert>; }

    // --- Display Data using EXACT casing from schema ---
    return (
        <div className={VISUALISATION_CONTAINER_CLASS}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="mb-0 fw-bold">Sous-Projet: {displayData(sousProjetData.Code_Sous_Projet)}</h3>
                <Button variant="warning" size="sm" onClick={onClose} className={VISUALISATION_CLOSE_BUTTON_CLASS} aria-label="Fermer">Revenir à la liste</Button>
            </div>

            {/* Main Content Grid */}
            <Row className="g-3 mb-3">

                {/* Card 1: Basic Info */}
                <Col md={6} lg={4}>
                    <Card className={CARD_CLASS}>
                        <Card.Body>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>Informations Générales</Card.Title>
                            <dl className={DL_CLASS}>
                                <dt className={DT_CLASS}>Code Sous-Projet:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Code_Sous_Projet)}</dd>
                                <dt className={DT_CLASS}>Nom Sous-Projet:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Nom_Projet)}</dd>
                                <dt className={DT_CLASS}>Projet Maître:</dt>
<dd className={DD_CLASS} title={sousProjetData.projet ? `Code: ${sousProjetData.projet.Code_Projet}` : ''}>
    {displayData(sousProjetData.projet?.Nom_Projet, `(Code: ${displayData(sousProjetData.ID_Projet_Maitre)})`)}
</dd>                                <dt className={DT_CLASS}>Statut:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Status)}</dd>
                                <dt className={DT_CLASS}>Secteur:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Secteur)}</dd>
                            </dl>
                        </Card.Body>
                    </Card>
                </Col>

                 {/* Card 2: Localisation */}
                <Col md={6} lg={4}>
                     <Card className={CARD_CLASS}>
                        <Card.Body>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>Localisation</Card.Title>
                             <dl className={DL_CLASS}>
                                <dt className={DT_CLASS}>Province:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.province?.Description, `(ID: ${sousProjetData.Id_Province})`)}</dd>
                                <dt className={DT_CLASS}>Commune:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.commune?.Description, `(Code: ${sousProjetData.Id_Commune})`)}</dd>
                                <dt className={DT_CLASS}>Localité:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Localite)}</dd>
                                <dt className={DT_CLASS}>Centre:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Centre)}</dd>
                                <dt className={DT_CLASS}>Site:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Site)}</dd>
                                <dt className={DT_CLASS}>Douars Desservis:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Douars_Desservis)}</dd>
                             </dl>
                        </Card.Body>
                    </Card>
                </Col>

                 {/* Card 3: Détails Techniques & Financiers */}
                 <Col md={6} lg={4}>
                     <Card className={CARD_CLASS}>
                        <Card.Body>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>Détails Techniques & Financiers</Card.Title>
                             <dl className={DL_CLASS}>
                                 <dt className={DT_CLASS}>Nature Intervention:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Nature_Intervention)}</dd>
                                 <dt className={DT_CLASS}>Surface:</dt><dd className={DD_CLASS}>{formatNumber(sousProjetData.Surface)}</dd>
                                 <dt className={DT_CLASS}>Linéaire:</dt><dd className={DD_CLASS}>{formatNumber(sousProjetData.Lineaire)}</dd>
                                 <dt className={DT_CLASS}>Av. Physique:</dt><dd className={DD_CLASS}>{formatPercentage(sousProjetData.Etat_Avan_Physi)}</dd>
                                 <dt className={DT_CLASS}>Av. Financier:</dt><dd className={DD_CLASS}>{formatPercentage(sousProjetData.Etat_Avan_Finan)}</dd>
                                 <dt className={DT_CLASS}>Estim. Initiale:</dt><dd className={`${DD_CLASS} fw-bold`}>{formatNumber(sousProjetData.Estim_Initi)}</dd> {/* Assuming currency/number */}
                                 <dt className={DT_CLASS}>Financement:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Financement)}</dd>
                                 <dt className={DT_CLASS}>Bénéficiaire:</dt><dd className={DD_CLASS}>{displayData(sousProjetData.Benificiaire)}</dd>
                             </dl>
                        </Card.Body>
                    </Card>
                 </Col>

                 {/* Card 4: Observations & Audit */}
                 <Col md={12} lg={8}> {/* Make observations wider */}
                     <Card className={CARD_CLASS}>
                        <Card.Body>
                             <Card.Title as="h6" className={CARD_TITLE_CLASS}>Observations & Audit</Card.Title>
                             <p className="small mb-3 text-muted fst-italic">{displayData(sousProjetData.Observations, "Aucune observation.")}</p>
                             <hr className="my-2" />
                             <dl className={`${DL_CLASS} mt-2`}>
                                <dt className={DT_CLASS}>Créé le:</dt><dd className={DD_CLASS}>{formatDate(sousProjetData.created_at)}</dd>
                                <dt className={DT_CLASS}>Modifié le:</dt><dd className={DD_CLASS}>{formatDate(sousProjetData.updated_at)}</dd>
                             </dl>
                        </Card.Body>
                    </Card>
                 </Col>

            </Row>
        </div>
    );
};

// Proptypes
SousProjetVisualisation.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, // Code_Sous_Projet
    onClose: PropTypes.func.isRequired,
    baseApiUrl: PropTypes.string.isRequired,
};

export default SousProjetVisualisation;