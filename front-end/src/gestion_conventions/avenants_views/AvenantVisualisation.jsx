import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faExclamationTriangle, faTimes, faFilePdf, faFileWord,
    faFileExcel, faFileImage, faFileAlt, faCalendarAlt, faInfoCircle,
    faEdit, faTags, faMoneyBillWave, faClock, faFileSignature, faListAlt,
    faAlignLeft, faComments, faPaperclip, faUsers, faDownload, faBuilding, // Added faBuilding
    faCheckCircle, faTimesCircle // Added check/times for signatory
} from '@fortawesome/free-solid-svg-icons';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Alert from 'react-bootstrap/Alert';
import PropTypes from 'prop-types';
import Spinner from 'react-bootstrap/Spinner';
import Badge from 'react-bootstrap/Badge';
import ListGroup from 'react-bootstrap/ListGroup';
// Removed Stack as ListGroup is used for partners now

// --- Helpers ---
const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString + 'T00:00:00Z');
        return date.toLocaleDateString('fr-CA'); // YYYY-MM-DD
    } catch (e) { return dateString; }
 };
const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(Number(amount))) return '-';
    return parseFloat(amount).toLocaleString('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 });
 };
const displayData = (data, fallback = '-') => (data !== null && data !== undefined && data !== '') ? data : fallback;
const getTypeModificationColor = (type) => {
    switch (type) {
        case 'montant': return 'success';
        case 'durée': return 'info';
        case 'partenaire': return 'warning';
        case 'autre': return 'secondary';
        default: return 'light';
    }
};
const getFileIcon = (filename) => {
    if (!filename) return faFileAlt;
    const lowerCase = String(filename).toLowerCase();
    if (lowerCase.includes('.pdf')) return faFilePdf;
    if (lowerCase.includes('.doc')) return faFileWord;
    if (lowerCase.includes('.xls')) return faFileExcel;
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].some(ext => lowerCase.endsWith(ext))) return faFileImage;
    return faFileAlt;
 };

// --- Define Type Modification Options ---
const typeModificationOptions = [
    { value: 'montant', label: 'Modification Montant' },
    { value: 'durée', label: 'Modification Durée' },
    { value: 'partenaire', label: 'Modification Partenaire(s)' },
    { value: 'autre', label: 'Autre Modification' },
];

// --- Component ---
const AvenantVisualisation = ({ itemId, onClose, baseApiUrl = 'http://192.168.30.241:81/api' }) => {
    const [avenantData, setAvenantData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Fetch Data ---
    const fetchData = useCallback(async () => {
        if (!itemId) { setLoading(false); setError("ID d'avenant manquant."); return; }

        setLoading(true); setError(null); setAvenantData(null);
        console.log(`[Avenant Visu] Fetching ID ${itemId}...`);
        try {
            // *** IMPORTANT: Use the correct include parameter ***
            const response = await axios.get(`${baseApiUrl}/avenants/${itemId}`, {
                 params: { include: 'convention,documents,partnerCommitments.partenaire' }, // <-- Match working setup
                 withCredentials: true
                });
            const data = response.data.avenant || response.data; // Access nested 'avenant' if needed
            console.log("[Avenant Visu] Raw Data Received:", data);
        
            
            if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                 // Ensure related arrays exist even if empty
                 data.documents = Array.isArray(data.documents) ? data.documents : [];
                 // *** IMPORTANT: Use the correct key from the API response ***
                 data.partnerCommitments = data.partner_commitments || []; // <-- Use 'partnerCommitments'
                 setAvenantData(data);
                 console.log("[Avenant Visu] Processed Data Set:", data);
            } else {
                throw new Error(`Aucune donnée ou format invalide pour l'avenant ID ${itemId}.`);
            }
        } catch (err) {
             console.error(`[Avenant Visu] API Error fetching ID ${itemId}:`, err.response || err);
             const errorMsg = err.response?.data?.message || err.response?.statusText || err.message || `Erreur de chargement (ID: ${itemId}).`;
             setError(errorMsg + (err.response ? ` (Status: ${err.response.status})` : ''));
        } finally { setLoading(false); }
    }, [itemId, baseApiUrl]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- Render Helpers ---
    const renderDetail = (label, value, icon = faInfoCircle, options = {}) => {
        const { formatFunc, conditionalCheck = () => true, highlight = false } = options;
        if (!conditionalCheck()) return null;
        const displayValue = formatFunc ? formatFunc(value) : displayData(value);
        const valueElement = React.isValidElement(displayValue) ? displayValue : (
            <span className={`text-dark text-start ${highlight ? 'text-success' : ''}`} style={{wordBreak: 'break-word'}}>
                {displayValue}
            </span>
        );
        return (
            <ListGroup.Item className="px-0 py-2 border-0 d-flex flex-wrap justify-content-between align-items-center">
                <span className="fw-medium text-secondary small me-2" style={{ flexShrink: 0 }}>
                    <FontAwesomeIcon icon={icon} className="me-2 text-warning" style={{width: '16px'}} /> <b>{label}</b>
                </span>
                {valueElement}
            </ListGroup.Item>
        );
     };
    const renderTextBlock = (label, value, icon = faAlignLeft) => {
         if (!value) return null;
         return (
             <Col xs={12} className="mb-3">
                 <Card className="border-light d-flex align-items-center flex-column shadow-sm">
                     <Card.Header className="bg-light py-2 border-bottom-0">
                        <Card.Title as="h6" className="mb-0 fw-semibold text-secondary small text-uppercase">
                             <FontAwesomeIcon icon={icon} className="me-2"/> {label}
                        </Card.Title>
                     </Card.Header>
                     <Card.Body className="pt-2">
                        <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{displayData(value)}</p>
                     </Card.Body>
                 </Card>
             </Col>
         );
     };

    // --- Render Logic ---
    if (loading) {
        return ( <div className="text-center p-5"><Spinner animation="border" variant="primary" /> <span className="ms-3 text-muted">Chargement...</span></div> );
    }
    if (error) {
         return ( <Alert variant="danger" className="m-3 m-md-4"><Alert.Heading><FontAwesomeIcon icon={faExclamationTriangle} className="me-2"/> Erreur</Alert.Heading><p>{error}</p><hr /><div className="d-flex justify-content-end"><Button onClick={onClose} variant="outline-danger" size="sm">Fermer</Button></div></Alert> );
    }
    if (!avenantData) {
         return ( <Alert variant="secondary" className="m-3 m-md-4">Aucune donnée disponible.<Button variant="link" size="sm" onClick={onClose} className="float-end">Fermer</Button></Alert> );
    }

    const typeModifColor = getTypeModificationColor(avenantData.type_modification);
    const typeModifLabel = typeModificationOptions.find(opt => opt.value === avenantData.type_modification)?.label || avenantData.type_modification;

    return (
        // Added overflowY auto for potentially long content
        <div className="p-5 p-md-4 avenant-visualisation-container bg-light" style={{ borderRadius: '15px', maxHeight: 'calc(90vh - 80px)', overflowY: 'auto' }}>
            {/* Header */}
            <div className="d-flex p-3 justify-content-between align-items-center mb-4 pb-2 border-bottom border-2">
                <h2 className="mb-0 fw-bold text-dark">
                     Détails Avenant: {displayData(avenantData.numero_avenant)}
                </h2>
                <Button variant="warning" onClick={onClose} className="btn rounded-5  px-5 fw-bold py-1 bg-warning shadow-sm" aria-label="Fermer">
                     Revenir a la liste
                </Button>
            </div>

            {/* Main Info Row */}
            <Row className="g-3 mb-4">
                {/* Col 1: General Info & Convention Link */}
                <Col md={avenantData.type_modification!=='partenaire'?6:12} lg={avenantData.type_modification!=='partenaire'?7:12}>
                    <Card className="h-100 border-light shadow-sm">
                        <Card.Header className="bg-light py-2 border-bottom-0">
                            <Card.Title as="h6" className="mb-0 fw-semibold text-secondary small text-uppercase">
                                <FontAwesomeIcon icon={faInfoCircle} className="me-2"/> Informations Générales
                            </Card.Title>
                        </Card.Header>
                        <Card.Body className="pt-2">
                            <ListGroup variant="flush">
                                {renderDetail("Convention Parent", avenantData.convention ? `${avenantData.convention?.Code} - ${avenantData.convention?.Intitule}` : '-', faFileSignature)}
                                {renderDetail("N° Avenant", avenantData.numero_avenant, faListAlt)}
                                {renderDetail("Date Signature", avenantData.date_signature, faCalendarAlt, { formatFunc: formatDate })}
                                {renderDetail("Type Modification",
                                    <Badge bg={typeModifColor} text={typeModifColor === 'light' || typeModifColor === 'warning' ? 'dark' : 'white'} pill>
                                        {displayData(typeModifLabel)}
                                    </Badge>,
                                faEdit)}
                            </ListGroup>
                        </Card.Body>
                    </Card>
                </Col>
                {/* Col 2: Specific Modifications */}
                {avenantData.type_modification!=='partenaire'?<Col md={6} lg={5}>
                    <Card className="h-100 border-light shadow-sm">
                         <Card.Header className="bg-light py-2 border-bottom-0">
                             <Card.Title as="h6" className="mb-0 fw-semibold text-secondary small text-uppercase">
                                <FontAwesomeIcon icon={faTags} className="me-2"/> Modifications Spécifiques
                             </Card.Title>
                         </Card.Header>
                        <Card.Body className="pt-2">
                            <ListGroup variant="flush">
                                {renderDetail("Montant Modifié", avenantData.montant_modifie, faMoneyBillWave, { formatFunc: formatCurrency, conditionalCheck: () => avenantData.type_modification === 'montant', highlight: true })}
                                {renderDetail("Nouvelle Date Fin", avenantData.nouvelle_date_fin, faClock, { formatFunc: formatDate, conditionalCheck: () => avenantData.type_modification === 'durée', highlight: true })}
                                {avenantData.type_modification !== 'montant' && avenantData.type_modification !== 'durée' && (
                                    <ListGroup.Item className="px-0 py-2 border-0">
                                        <span className="text-muted fst-italic small">Aucune modification spécifique de montant ou durée.</span>
                                    </ListGroup.Item>
                                )}
                            </ListGroup>
                        </Card.Body>
                    </Card>
                 </Col>:<></>}
            </Row>

             {/* Row 2: Objet & Remarques */}
            <Row className="g-3 mb-4">
                 {renderTextBlock("Objet de l'Avenant", avenantData.objet, faAlignLeft)}
                 {renderTextBlock("Remarques", avenantData.remarques, faComments)}
            </Row>

             {/* --- Partenaires Section (Displaying details) --- */}
             {/* *** Conditionally render OR always show with different title *** */}
             {/* Option A: Only show if type is 'partenaire' */}
             {/* {avenantData.type_modification === 'partenaire' && ( */}
             {/* Option B: Always show, adjust title */}
             {(avenantData.partnerCommitments && avenantData.partnerCommitments.length > 0) && ( // Show if there ARE commitments regardless of type
                 <Row className="mt-4 pt-3 border-top mx-md-3">
                    <Col xs={12}>
                        <h5 className="text-uppercase text-secondary fs-6 fw-semibold mb-3">
                            <FontAwesomeIcon icon={faUsers} className='me-2 text-secondary'/>
                            {/* Adjust Title Based on Context */}
                            {avenantData.type_modification === 'partenaire'
                                ? `Partenaires Concernés par la Modification (${avenantData.partnerCommitments.length})`
                                : `Détails Partenaires de l'Avenant (${avenantData.partnerCommitments.length})`
                            }
                        </h5>
                        <ListGroup variant="flush" className='partner-details-list'>
                            {/* *** IMPORTANT: Iterate over partnerCommitments *** */}
                            {avenantData.partnerCommitments.map((commit, index) => (
                                <ListGroup.Item key={commit.Id_CP || index} className="px-0 py-3 border-bottom-dashed">
                                     <Row className="g-2 align-items-center">
                                         <Col xs={12} md={5} className="fw-bold text-dark">
                                             <FontAwesomeIcon icon={faBuilding} className="me-2 text-warning"/>
                                             {/* Use nested 'partenaire' data */}
                                             {commit.partenaire?.Description || `ID Partenaire: ${commit.Id_Partenaire}`}
                                         </Col>
                                         <Col xs={6} md={3}>
                                              <span className='text-muted small d-block'>Montant Convenu:</span>
                                              {/* Use data directly from 'commit' */}
                                              {formatCurrency(commit.Montant_Convenu)}
                                         </Col>
                                         <Col xs={6} md={4}>
                                            <span className='text-muted small d-block'>Signataire:</span>
                                            <FontAwesomeIcon
                                                icon={commit.is_signatory ? faCheckCircle : faTimesCircle}
                                                className={`me-1 ${commit.is_signatory ? 'text-success' : 'text-danger'}`}
                                                title={commit.is_signatory ? 'Signataire' : 'Non Signataire'}
                                            />
                                            {commit.is_signatory ? 'Oui' : 'Non'}
                                            {commit.is_signatory && commit.date_signature && (
                                                <span className='text-muted small ms-2'>({formatDate(commit.date_signature)})</span>
                                            )}
                                         </Col>
                                         {commit.is_signatory && commit.details_signature && (
                                             <Col xs={12} className='mt-1'>
                                                <p className='mb-0 text-muted small fst-italic'>
                                                    <span className='fw-medium'>Détails Signature:</span> {commit.details_signature}
                                                </p>
                                             </Col>
                                         )}
                                     </Row>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </Col>
                </Row>
             )}


            {/* --- Fichiers Section --- */}
            <Row className="mt-4 pt-3 border-top mx-md-3">
                <Col xs={12}>
                    <h5 className="text-uppercase text-secondary fs-6 fw-semibold mb-3">
                        <FontAwesomeIcon icon={faPaperclip} className='me-2 text-secondary'/>
                        Fichiers Associés ({avenantData.documents.length})
                    </h5>
                    {avenantData.documents.length > 0 ? (
                        <ListGroup variant="" className=" d-flex flex-row flex-wrap justify-content-center">
                            {avenantData.documents.map(doc => {
                                const fileUrl = doc.fichier_url;
                                const filename = doc.file_name || 'Fichier sans nom';
                                const fileIcon = getFileIcon(filename);
                                return (
                                     <ListGroup.Item key={doc.Id_Doc} className="px-3 rounded-4  m-2  py-2 d-flex justify-content-between align-items-center bg-dark text-white">
                                         <div>
                                             <FontAwesomeIcon icon={fileIcon} className='me-2 text-warning'/>
                                             <span className="text-truncate" title={filename} style={{maxWidth: 'calc(100% - 50px)'}}>{filename}</span>
                                         </div>
                                         {fileUrl ? (
                                             <a
                                                href={fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-sm btn-outline-warning ms-2 py-0 px-2"
                                                title={`Voir / Télécharger ${filename}`}
                                              >
                                                 <FontAwesomeIcon icon={faDownload} />
                                             </a>
                                         ) : <Badge bg="light" text="muted" className='border'>(Lien Indisponible)</Badge>}
                                     </ListGroup.Item>
                                );
                             })}
                        </ListGroup>
                    ) : (
                       <p className="text-muted fst-italic small">Aucun fichier associé à cet avenant.</p>
                    )}
                </Col>
            </Row>
        </div>
    );
};

// --- PropTypes ---
AvenantVisualisation.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    onClose: PropTypes.func.isRequired,
    baseApiUrl: PropTypes.string,
};

// Default Props if needed
AvenantVisualisation.defaultProps = {
     baseApiUrl: 'http://192.168.30.241:81/api',
};


export default AvenantVisualisation;