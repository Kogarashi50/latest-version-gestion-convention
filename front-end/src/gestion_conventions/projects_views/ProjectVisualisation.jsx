import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Added useMemo
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faExclamationTriangle, faCheckCircle, faTimesCircle, faUsers,
    faEuroSign, faCalendarAlt, faInfoCircle, faHandHoldingUsd, // Paid amount
    faBalanceScaleLeft, // Remaining amount
    faFileInvoiceDollar // Engaged amount
} from '@fortawesome/free-solid-svg-icons';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Alert from 'react-bootstrap/Alert';
import PropTypes from 'prop-types';
import Spinner from 'react-bootstrap/Spinner';
import ListGroup from 'react-bootstrap/ListGroup';
import Badge from 'react-bootstrap/Badge';
import ProgressBar from 'react-bootstrap/ProgressBar'; // Added ProgressBar

// --- Helpers (Copied & Enhanced) ---
const formatPercentage = (value) => { const n = parseFloat(value); return isNaN(n)?'-':`${n.toFixed(2)} %`; };
// Using MAD currency now
const formatCurrency = (value) => { const n = parseFloat(value); return isNaN(n)?'-':n.toLocaleString('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const displayData = (data, fallback = '-') => data ?? fallback;
const formatDate = (dateString) => { if (!dateString) return '-'; try { return new Date(dateString).toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return dateString; } };
const formatDateSimple = (dateString) => { if (!dateString) return '-'; try { if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) { return new Date(dateString).toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' }); } const d=new Date(dateString); return isNaN(d.getTime())?dateString:d.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (e) { return dateString; } };
const formatBoolean = (value) => value ?<> <FontAwesomeIcon icon={faCheckCircle} className="text-success" title="Oui"/><span className='small text-muted ms-1'>(Formalisé) </span></>: <><FontAwesomeIcon icon={faTimesCircle} className="text-secondary" title="Non"/><span className='small text-muted ms-1'>(non Formalisé)</span> </>;
// --- End Helpers ---

// --- Styles/Classes (Copied from previous version) ---
const VISUALISATION_CONTAINER_CLASS = "p-3 p-md-4 convention-visualisation-container";
const VISUALISATION_CLOSE_BUTTON_CLASS = 'float-end py-2 rounded-5 shadow fw-bold px-5';
const CARD_CLASS = "h-100 border-light shadow-sm";
const CARD_TITLE_CLASS = "mb-3 fw-semibold text-secondary text-uppercase small";
const DL_CLASS = "row mb-0 dl-compact"; // Compact definition list style
const DT_CLASS = "col-sm-5 fw-bold text-dark"; // Definition term style
const DD_CLASS = "col-sm-7"; // Definition description style
const PARTNER_CARD_CLASS = "mb-3 border-light shadow-sm"; // Style for individual partner cards
// --- End Styles/Classes ---


const ProjetVisualisation = ({ itemId, onClose, baseApiUrl }) => {
    const [projetData, setProjetData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchProjet = useCallback(async () => {
        if (!itemId || !baseApiUrl) {
            setError("ID Projet ou URL API manquant.");
            setLoading(false);
            return;
         }
        setLoading(true); setError(null); setProjetData(null);
        // Ensure the controller's `show` method eager loads:
        // Projet::with([...relations..., 'engagementsFinanciers' => fn($q) => $q->with(['partenaire', 'versements'])])->findOrFail($id);
        const fetchUrl = `${baseApiUrl}/projets/${itemId}`;
        try {
            console.log(`Fetching project data from: ${fetchUrl}`);
            const response = await axios.get(fetchUrl, { withCredentials: true });
            const data = response.data.projet || response.data;
            console.log("Received project data:", data);

            if (data && typeof data === 'object') {
                 // Optional: Check for expected nested data
                 if (!data.domaine) console.warn(`Domaine data missing for Projet ${itemId}.`);
                 if (!data.programme) console.warn(`Programme data missing for Projet ${itemId}.`);
                 if (!data.chantier) console.warn(`Chantier data missing for Projet ${itemId}.`);
                 if (!data.convention) console.warn(`Convention data missing for Projet ${itemId}.`);
                 if (!data.engagements_financiers) {
                    console.warn(`Engagements Financiers data missing for Projet ${itemId}.`);
                 } else if (Array.isArray(data.engagements_financiers)) {
                    let missingPartnerData = false;
                    let missingVersementData = false;
                    data.engagements_financiers.forEach((eng, index) => {
                        if(!eng.partenaire) {
                            console.warn(`Partenaire data missing for Engagement #${index+1} (ID: ${eng.id}) in Projet ${itemId}.`);
                            missingPartnerData = true;
                        }
                        // *** CHECK FOR VERSEMENTS ARRAY ***
                        if(!eng.versements || !Array.isArray(eng.versements)) {
                             console.warn(`Versements array missing or invalid for Engagement #${index+1} (ID: ${eng.id}) in Projet ${itemId}. Ensure backend eager loads 'engagementsFinanciers.versements'.`);
                             missingVersementData = true;
                             // Ensure it's an empty array if missing, for calculations
                             if (eng) eng.versements = [];
                        }
                    });
                    if (missingPartnerData) console.error("One or more engagements are missing partner details!");
                    if (missingVersementData) console.error("One or more engagements are missing versements details! Check backend query.");
                 }
                setProjetData(data);
            } else { setError(`Format de données invalide reçu pour ID ${itemId}.`); }
        } catch (err) {
            console.error("Error fetching project:", err.response || err);
            const eMsg = err.response?.data?.message || err.message || 'Erreur inconnue';
            setError(`Erreur chargement: ${eMsg} (Status: ${err.response?.status})`);
        }
        finally { setLoading(false); }
    }, [itemId, baseApiUrl]);

    useEffect(() => { fetchProjet(); }, [fetchProjet]);

    // --- Calculate Financial Summary using useMemo ---
    const financialSummary = useMemo(() => {
        if (!projetData || !projetData.engagements_financiers) {
            return { partnerSummary: {}, totalPaid: 0, totalEngagedProject: 0 };
        }

        const summary = {
            partnerSummary: {},
            totalPaid: 0,
            totalEngagedProject: 0 // Total engaged specifically for the project from partners
        };

        projetData.engagements_financiers.forEach(eng => {
            // Use partenaire.Id if available (from eager loading), fallback to partenaire_id
            const partnerId = eng.partenaire?.Id || eng.partenaire_id;
            const partnerName = eng.partenaire?.Description || eng.partenaire?.Description_Arr||`Partenaire ID: ${partnerId}`;

            if (!partnerId) {
                console.warn("Skipping engagement with missing partner ID:", eng);
                return; // Skip if no partner ID
            }

            if (!summary.partnerSummary[partnerId]) {
                summary.partnerSummary[partnerId] = {
                    name: partnerName,
                    totalEngaged: 0,
                    totalVersed: 0,
                    // Store individual engagements if needed later for detailed view
                    // engagements: []
                };
            }

            const engagedAmount = parseFloat(eng.montant_engage || 0);
            const currentEngagementVersed = eng.versements?.reduce(
                (sum, v) => sum + parseFloat(v.montant_verse || 0), 0
            ) ?? 0; // Use ?? 0 as fallback if versements is null/undefined

            summary.partnerSummary[partnerId].totalEngaged += engagedAmount;
            summary.partnerSummary[partnerId].totalVersed += currentEngagementVersed;

            summary.totalPaid += currentEngagementVersed; // Add to grand total paid
            summary.totalEngagedProject += engagedAmount; // Add to grand total engaged by partners

            // Add engagement details if needed later
            // summary.partnerSummary[partnerId].engagements.push({ ...eng, montant_verse_engagement: currentEngagementVersed });
        });

        return summary;

    }, [projetData]); // Recalculate only when projetData changes

    // --- Render Logic ---
    if (loading) { return <div className="text-center p-5 d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}><Spinner animation="border" variant="primary" className="me-3"/><span className="text-muted">Chargement du projet...</span></div>; }
    if (error) { return <Alert variant="danger" className="m-3 m-md-4"><Alert.Heading><FontAwesomeIcon icon={faExclamationTriangle} className="me-2"/> Erreur</Alert.Heading><p>{error}</p><hr/><Button onClick={onClose} variant="outline-danger" size="sm">Fermer</Button></Alert>; }
    if (!projetData) { return <Alert variant="warning" className="m-3 m-md-4">Aucune donnée disponible pour ce projet (ID: {itemId}).<Button variant="link" size="sm" onClick={onClose} className="float-end">Fermer</Button></Alert>; }

    // Extract calculated values
    const { partnerSummary, totalPaid, totalEngagedProject } = financialSummary;
    const projectCost = parseFloat(projetData.Cout_Projet || 0);
    const remainingAmount = projectCost - totalPaid;
    const paymentProgress = projectCost > 0 ? (totalPaid / projectCost) * 100 : 0;

    return (
        <div className={VISUALISATION_CONTAINER_CLASS}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h5 className="text-uppercase fw-bold text-secondary mb-1">Détails du Projet</h5>
                    <h2 className="mb-0 fw-bold">{displayData(projetData.Nom_Projet)} <small className="text-muted">({displayData(projetData.Code_Projet)})</small></h2>
                </div>
                <Button variant="warning" size="sm" onClick={onClose} className={VISUALISATION_CLOSE_BUTTON_CLASS} aria-label="Fermer">Revenir à la liste</Button>
            </div>

            {/* Main Content Grid */}
            <Row className="g-3">

                {/* Card 1: Basic Info */}
                <Col md={6} lg={4}>
                    <Card className={CARD_CLASS}>
                        <Card.Body>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>Informations Projet</Card.Title>
                            <dl className={DL_CLASS}>
                                <dt className={DT_CLASS}>Code Projet:</dt><dd className={DD_CLASS}>{displayData(projetData.Code_Projet)}</dd>
                                <dt className={DT_CLASS}>Nom Projet:</dt><dd className={DD_CLASS}>{displayData(projetData.Nom_Projet)}</dd>
                                <dt className={DT_CLASS}>Convention:</dt><dd className={DD_CLASS} title={projetData.convention?.Intitule}>{displayData(projetData.Convention_Code)} - {projetData.convention?.Intitule ? String(projetData.convention.Intitule):'-'}</dd>
                            </dl>
                        </Card.Body>
                    </Card>
                </Col>

                 {/* Card 2: Associations */}
                <Col md={6} lg={4}>
                     <Card className={CARD_CLASS}>
                        <Card.Body>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>Associations</Card.Title>
                             <dl className={DL_CLASS}>
                                <dt className={DT_CLASS}>Domaine:</dt><dd className={DD_CLASS}>{displayData(projetData.domaine?.Description, `(Ref: ${projetData.Id_Domaine})`)}</dd>
                                <dt className={DT_CLASS}>Programme:</dt><dd className={DD_CLASS} title={projetData.programme?.Description}>{displayData(projetData.programme?.Description, `(Ref: ${projetData.Id_Programme})`)}</dd>
                                <dt className={DT_CLASS}>Chantier:</dt><dd className={DD_CLASS}>{displayData(projetData.chantier?.Description, `(Ref: ${projetData.Id_Chantier})`)}</dd>
                             </dl>
                        </Card.Body>
                    </Card>
                </Col>

                 {/* Card 3: Dates & Avancement */}
                 <Col md={6} lg={4}>
                     <Card className={CARD_CLASS}>
                        <Card.Body>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>Dates & Avancement</Card.Title>
                             <dl className={DL_CLASS}>
                                 <dt className={DT_CLASS}>Date Début:</dt><dd className={DD_CLASS}>{formatDateSimple(projetData.Date_Debut)}</dd>
                                 <dt className={DT_CLASS}>Date Fin:</dt><dd className={DD_CLASS}>{formatDateSimple(projetData.Date_Fin)}</dd>
                                 <dt className={DT_CLASS}>Av. Physique:</dt><dd className={DD_CLASS}>{formatPercentage(projetData.Etat_Avan_Physi)}</dd>
                                 <dt className={DT_CLASS}>Av. Financier:</dt><dd className={DD_CLASS}>{formatPercentage(projetData.Etat_Avan_Finan)}</dd>
                             </dl>
                        </Card.Body>
                    </Card>
                 </Col>

                {/* Card 4: Finance Summary (REVISED) */}
                <Col md={6} lg={6}>
                     <Card className={CARD_CLASS}>
                        <Card.Body>
                            <Card.Title as="h6" className={CARD_TITLE_CLASS}>Synthèse Financière</Card.Title>
                            <dl className={DL_CLASS}>
                                <dt className={DT_CLASS}>Coût Projet Total:</dt>
                                <dd className={`${DD_CLASS} fw-bold`}>{formatCurrency(projectCost)}</dd>

                                <dt className={DT_CLASS}>Total Versé <small>(par Partenaires)</small>:</dt>
                                <dd className={`${DD_CLASS} fw-bold text-success`}>{formatCurrency(totalPaid)}</dd>

                                <dt className={DT_CLASS}>Reste à Financer:</dt>
                                <dd className={`${DD_CLASS} fw-bold ${remainingAmount > 0 ? 'text-danger' : 'text-info'}`}>
                                    {formatCurrency(remainingAmount)}
                                </dd>

                                <dt className={DT_CLASS}>Coût Part CRO:</dt>
                                <dd className={DD_CLASS}>{formatCurrency(projetData.Cout_CRO)}</dd>

                                <dt className={DT_CLASS}>Engagé <small>(par Partenaires)</small>:</dt>
                                <dd className={DD_CLASS}>{formatCurrency(totalEngagedProject)}</dd>
                            </dl>
                            <hr className="my-2"/>
                            <div className="mt-2">
                                <small className="text-muted">Progression Paiements vs Coût Total</small>
                                <ProgressBar
                                    now={paymentProgress}
                                    label={`${paymentProgress.toFixed(1)}%`}
                                    variant="success"
                                    striped
                                    animated
                                    className="mt-1"
                                    style={{height: '10px'}}
                                    title={`Payé: ${formatCurrency(totalPaid)} / ${formatCurrency(projectCost)}`}
                                />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

                 {/* Card 5: Observations & Audit Dates */}
                 <Col md={6} lg={6}>
                     <Card className={CARD_CLASS}>
                        <Card.Body className="d-flex flex-column">
                             <Card.Title as="h6" className={CARD_TITLE_CLASS}>Observations & Audit</Card.Title>
                             <div className="mb-3 flex-grow-1" style={{maxHeight: '120px', overflowY: 'auto'}}>
                                 <p className="small mb-0">{displayData(projetData.Observations)}</p>
                             </div>
                             <dl className={`${DL_CLASS} mt-auto`}> {/* Push dates to bottom */}
                                <dt className={DT_CLASS}>Créé le:</dt><dd className={DD_CLASS}>{formatDate(projetData.created_at)}</dd>
                                <dt className={DT_CLASS}>Modifié le:</dt><dd className={DD_CLASS}>{formatDate(projetData.updated_at)}</dd>
                             </dl>
                        </Card.Body>
                    </Card>
                 </Col>

                 {/* Card 6: Partner Contributions (REVISED) */}
                 <Col md={12}> {/* Make full width */}
                     <Card className="border-light shadow-sm"> {/* Remove h-100 if content varies */}
                        <Card.Body>
                             <Card.Title as="h6" className={CARD_TITLE_CLASS}>
                                <FontAwesomeIcon icon={faUsers} className="me-2"/> Contributions des Partenaires
                             </Card.Title>
                             {Object.keys(partnerSummary).length > 0 ? (
                                 <Row className="g-3">
                                     {Object.entries(partnerSummary).map(([partnerId, summary]) => {
                                         const partnerRemaining = summary.totalEngaged - summary.totalVersed;
                                         const paymentRatio = summary.totalEngaged > 0 ? (summary.totalVersed / summary.totalEngaged) * 100 : 0;
                                         return (
                                            <Col key={partnerId}>
                                                <Card className={PARTNER_CARD_CLASS}>
                                                    <Card.Header className="bg-light py-2 px-3">
                                                        <h6 className="mb-0 text-dark fw-semibold text-truncate" title={summary.name}>
                                                          <FontAwesomeIcon icon={faUsers} className="me-2 text-primary"/>
                                                          {summary.name}
                                                        </h6>
                                                    </Card.Header>
                                                    <ListGroup variant="flush">
                                                        <ListGroup.Item className="d-flex justify-content-between align-items-center px-3 py-2">
                                                            <span><FontAwesomeIcon icon={faFileInvoiceDollar} className="me-2 text-info" title="Engagé"/> Engagé:</span>
                                                            <Badge bg="info" pill>{formatCurrency(summary.totalEngaged)}</Badge>
                                                        </ListGroup.Item>
                                                        <ListGroup.Item className="d-flex justify-content-between align-items-center px-3 py-2">
                                                            <span><FontAwesomeIcon icon={faHandHoldingUsd} className="me-2 text-success" title="Versé"/> Versé:</span>
                                                            <Badge bg="success" pill>{formatCurrency(summary.totalVersed)}</Badge>
                                                        </ListGroup.Item>
                                                         <ListGroup.Item className="d-flex justify-content-between align-items-center px-3 py-2">
                                                           {partnerRemaining!=0?<><span><FontAwesomeIcon icon={faBalanceScaleLeft} className="me-2 text-warning" title="Restant"/> Restant:</span>
                                                            <Badge bg={partnerRemaining > 0 ? "warning" : "light"} text={partnerRemaining > 0 ? "dark" : "danger"} pill>
                                                                {formatCurrency(partnerRemaining)}
                                                            </Badge></>:<><div></div><Badge bg='success'  text='light' pill>
                                                                Soldé
                                                            </Badge></>
                                                            } 
                                                        </ListGroup.Item>
                                                         <ListGroup.Item className="px-3 py-2">
                                                            <ProgressBar
                                                                now={paymentRatio}
                                                                variant="success"
                                                                style={{ height: '6px' }}
                                                                title={`Payé: ${paymentRatio.toFixed(1)}% de l'engagement`}
                                                             />
                                                         </ListGroup.Item>
                                                        {/* Optional: Add a button/link here to show detailed engagements/versements later */}
                                                    </ListGroup>
                                                </Card>
                                            </Col>
                                        );
                                    })}
                                 </Row>
                             ) : (
                                 <Alert variant="secondary" className="text-center">
                                     Aucun engagement financier (ou partenaire associé) trouvé pour ce projet.
                                 </Alert>
                             )}
                        </Card.Body>
                    </Card>
                 </Col>
                 {/* === End Partner Contributions Card === */}

            </Row>
        </div>
    );
};

// --- Proptypes ---
ProjetVisualisation.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    onClose: PropTypes.func.isRequired,
    baseApiUrl: PropTypes.string.isRequired,
};

export default ProjetVisualisation;