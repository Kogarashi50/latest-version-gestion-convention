// src/gestion_contrats_cdc_views/ContratDroitCommunVisualisation.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { Button, Row, Col, ListGroup, Spinner, Alert } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faFileAlt, faTimes,faPaperclip, faBuilding, faCalendarAlt, faFileInvoiceDollar, faTag, faFileContract, faInfoCircle, faClock, faExclamationTriangle, faHashtag, faAlignLeft, faFileSignature, faHandHoldingUsd, faRulerHorizontal, faListAlt, faMoneyCheckAlt, faCommentDots } from '@fortawesome/free-solid-svg-icons';

// Import shared CSS or create specific styles
import '../bon_commandes_views/boncmd.css'; // Reuse existing styles if suitable

// --- Environment Variables ---
const BASE_API_URL =  'http://192.168.30.241:81/api';
const STORAGE_URL = 'http://192.168.30.241:81/storage'; // Make sure this points to your storage link

// --- Helper Functions ---
const formatDecimal = (value, currency = 'MAD', decimals = 2) => { // Default currency MAD
    const number = parseFloat(value);
    if (isNaN(number) || value === null || value === undefined) return '-';
    const formatted = number.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); // Use fr-MA for MAD
    return currency ? `${formatted} ${currency}` : formatted;
};

const formatDateSimple = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString); // Treat as UTC date
        if (isNaN(date.getTime())) {
             console.warn("Visualisation: Invalid date received:", dateString);
             return dateString;
        }
        return date.toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }); // YYYY-MM-DD
    } catch (e) {
        console.error("Visualisation: Error formatting date:", dateString, e);
        return dateString;
    }
};

const displayData = (data, fallback = '-') => data ?? fallback;

// --- Component Definition ---
const ContratDroitCommunVisualisation = ({ itemId, onClose, baseApiUrl = BASE_API_URL }) => {
    const [contratData, setContratData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
console.log(itemId)
    // --- Fetching Logic ---
    const fetchData = useCallback(async () => {
        if (!itemId) {
            setContratData(null); setLoading(false); setError(null);
            return;
        }

        console.log(`[CDC Visualisation] Fetching data for Contrat ID: ${itemId}`);
        setLoading(true); setError(null); setContratData(null);

        try {
            // Fetch contract WITH associated files
            const response = await axios.get(`${baseApiUrl}/contrat-droit-commun/${itemId}`, {
                params: { include: 'fichiers' }, // Tell backend to eager load files
                withCredentials: true // If using Sanctum/Session auth
            });
            const cdcData = response.data.contrat_droit_commun || response.data;

            if (cdcData && typeof cdcData === 'object' && Object.keys(cdcData).length > 0) {
                 cdcData.fichiers = Array.isArray(cdcData.fichiers) ? cdcData.fichiers : [];
                 setContratData(cdcData);
                 console.log("[CDC Visualisation] Data Received:", cdcData);
            } else {
                throw new Error(`Aucune donnée ou format invalide reçu pour le contrat ID ${itemId}.`);
            }
        } catch (err) {
            console.error(`[CDC Visualisation] API Error fetching ID ${itemId}:`, err.response || err);
            const errorMsg = err.response?.data?.message || err.response?.statusText || err.message || `Erreur de chargement (ID: ${itemId}).`;
            setError(errorMsg + (err.response ? ` (Status: ${err.response.status})` : ''));
            setContratData(null);
        } finally {
            setLoading(false);
        }
    }, [itemId, baseApiUrl]);

    // Effect to trigger fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]); // fetchData includes itemId

    // --- Render Logic ---
    const renderField = (label, value, icon = null, className = "mb-3", extraClass = "") => (
        <div className={`${className} bc-data-point`}> {/* Reuse BC styling class */}
             <p className={`text-dark d-flex justify-content-between titly mb-1 ${extraClass}`}>
                <b>
                    {icon && <FontAwesomeIcon icon={icon} className="me-2 text-warning" />} {/* Primary color icon */}
                    <span>{label}</span>
                </b>
                <span className="fs-6 text-end">{displayData(value)}</span>
             </p>
        </div>
    );

    const renderFieldBlock = (label, value, icon = null, className = "mb-3") => (
        <div className={`${className} bc-data-point d-flex flex-column  justify-content-center `}> {/* Reuse BC styling class */}
             <p className="text-dark mb-1 titly">
                 <b>
                    {icon && <FontAwesomeIcon icon={icon} className="me-2 text-warning" />}
                    <span>{label}</span>
                </b>
            </p>
             <p className="fs-6  p-2 rounded-5 border px-4 bg-white shadow-sm" style={{ whiteSpace: 'pre-wrap' }}>{displayData(value)}</p> {/* Wrap long text */}
        </div>
    );

    // --- Loading State ---
    if (loading) {
        return (
             <div className="text-center p-4">
                 <Spinner animation="border" variant="primary" />
                 <p className="mt-2 text-muted">Chargement des détails du contrat...</p>
            </div>
        );
    }

    // --- Error State ---
    if (error) {
         return (
             <Alert variant="danger" className="m-3">
                 <FontAwesomeIcon icon={faExclamationTriangle} className="me-2"/> {error}
                 {onClose && <Button variant="link" className="btn-close float-end" onClick={onClose}></Button>}
            </Alert>
         );
     }

    // --- No Data State ---
    if (!contratData) {
         return (
            <div className="text-center p-4">
                 <p className="mt-2 text-muted">Aucune donnée de contrat à afficher.</p>
            </div>
         );
     }

    // --- Main Content Rendering ---
    return (
        <div className="p-3  bc-visualisation-container holder"> {/* Reuse BC container style */}
             {/* Header */}
             <div className="d-flex p-5 justify-content-between align-items-start mb-4 px-md-5 border-bottom holder pb-2">
                <h2 className='mb-1 fw-bold text-dark'>
                    Contrat: <span className="text-dark">{contratData.numero_contrat}</span>
                </h2>
                {onClose && (
                     <Button variant="warning" onClick={onClose} title="Retour" className="px-5 py-2 border-0 rounded-5 shadow-sm">
                         <b>Revenir à la liste</b>
                     </Button>
                 )}
             </div>

            <Row className='mt-4 px-md-4'>
                {/* --- Main Details Column 1 --- */}
                <Col md={5} className='border rounded-5 bg-white shadow-sm m-4  p-4'>
                    {renderField("Fournisseur", contratData.fournisseur_nom, faBuilding)}
                    {renderField("Date Signature", formatDateSimple(contratData.date_signature), faCalendarAlt)}
                    {renderField("Montant Total", formatDecimal(contratData.montant_total, 'MAD'), faHandHoldingUsd)}
                    {renderField("Durée", contratData.duree_contrat, faClock)}
                </Col>
                <Col md={1}></Col>

                {/* --- Main Details Column 2 --- */}
                <Col md={5} className='border rounded-5 bg-white m-4 shadow-sm  p-4'>
                    {renderField("Type Contrat", contratData.type_contrat, faListAlt)}
                    {renderField("Mode Paiement", contratData.mode_paiement, faMoneyCheckAlt)}
                    {/* Optionally show creation/update dates if available */}
                    {/* {contratData.created_at && renderField("Créé le", formatDateSimple(contratData.created_at), faClock)} */}
                    {/* {contratData.updated_at && renderField("Modifié le", formatDateSimple(contratData.updated_at), faClock)} */}
                </Col>

            </Row>

            <Row className='mt-4 px-md-4'>
                {/* --- Objet --- */}
                <Col xs={6}>
                    {renderFieldBlock("Objet du Contrat", contratData.objet, faAlignLeft)}
                </Col>
                {/* --- Observations --- */}
                {contratData.observations && (
                     <Col xs={6} >
                         {renderFieldBlock("Observations", contratData.observations, faCommentDots)}
                     </Col>
                )}
            </Row>

            {/* --- Fichiers Section --- */}
            <Row className="mt-4 pt-3 border-top mx-md-3">
                <Col xs={12}>
                    <h5 className="text-uppercase titly text-muted fs-4">
                        <FontAwesomeIcon icon={faPaperclip} className='me-2'/>
                        Fichiers Associés ({contratData.fichiers.length})
                    </h5>
                    {Array.isArray(contratData.fichiers) && contratData.fichiers.length > 0 ? (
                        <ListGroup variant="flush" className=" d-flex justify-content-evenly flex-wrap flex-row align-items-center p-2 "> {/* Reuse file list style */}
                            {contratData.fichiers.map(file => (
                                file && file.id ? (
                                    <ListGroup.Item key={file.id} className="border rounded-4 p-2 d-flex align-items-center bg-dark  m-1 text-white">
                                        <div>
                                            <FontAwesomeIcon icon={faFileAlt} className='me-2 text-warning'/>
                                            <span className="text-truncate" title={file.nom_fichier || 'Nom inconnu'}>
                                                {file.nom_fichier || 'Fichier sans nom'}
                                            </span>
                                            <span className='text-muted small ms-2'>({formatDateSimple(file.date_ajout)})</span>
                                        </div>
                                        {file.chemin_fichier && (
                                            <a
                                                href={`${STORAGE_URL}/${file.chemin_fichier}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-sm btn-outline-warning ms-2 py-0 px-2"
                                                title="Voir / Télécharger"
                                            >
                                                <FontAwesomeIcon icon={faDownload}  className='text-warning' />
                                            </a>
                                        )}
                                    </ListGroup.Item>
                                ) : null
                            ))}
                        </ListGroup>
                    ) : (
                       <p className="text-muted fst-italic small">Aucun fichier associé à ce contrat.</p>
                    )}
                </Col>
            </Row>
        </div>
    );
};

// --- PropTypes ---
ContratDroitCommunVisualisation.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    onClose: PropTypes.func.isRequired,
    baseApiUrl: PropTypes.string
};

export default ContratDroitCommunVisualisation;