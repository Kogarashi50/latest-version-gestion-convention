// src/pages/projets_views/VersementPPForm.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faExclamationTriangle, faTimes, faCheckCircle, faInfoCircle, faReceipt, faCalendarAlt, faProjectDiagram, faUsers, faStickyNote, faCreditCard, faEuroSign
} from '@fortawesome/free-solid-svg-icons';
import Select from 'react-select';
import {
    Form, Button, Row, Col, Alert, Spinner, Card, InputGroup, FormLabel, Stack
} from 'react-bootstrap';
import PropTypes from 'prop-types';

// --- Styles & Classes ---
const selectStyles = { /* Your existing selectStyles */
    control: (provided, state) => ({ ...provided, backgroundColor: '#f8f9fa', borderRadius: '1.5rem', border: state.isFocused ? '1px solid #86b7fe' : '1px solid #ced4da', boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : 'none', minHeight: '38px', }), valueContainer: (provided) => ({ ...provided, padding: '0.25rem 0.8rem', }), input: (provided) => ({ ...provided, margin: '0px', padding: '0px', }), indicatorSeparator: () => ({ display: 'none', }), indicatorsContainer: (provided) => ({ ...provided, padding: '1px', }), placeholder: (provided) => ({ ...provided, color: '#6c757d', }), menu: (provided) => ({ ...provided, borderRadius: '0.5rem', boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)', zIndex: 1050 }), option: (provided, state) => ({ ...provided, backgroundColor: state.isSelected ? '#0d6efd' : state.isFocused ? '#e9ecef' : null, color: state.isSelected ? 'white' : 'black', }),
};
const FORM_CONTAINER_CLASS = "p-3 p-md-4 versement-form-container";
const FORM_CONTROL_CLASS = "p-2 mt-1 mb-3 rounded-pill shadow-sm bg-light border";
const FORM_TEXTAREA_CLASS = "p-2 mt-1 mb-3 rounded shadow-sm bg-light border"; // Adjusted border radius
const FORM_ACTIONS_ROW_CLASS = "mt-4 pt-2 justify-content-center flex-shrink-0";
const FORM_CANCEL_BUTTON_CLASS = "btn px-5 rounded-5 py-1 bg-danger border-0";
const FORM_SUBMIT_BUTTON_CLASS = "btn rounded-5 px-5 py-1 align-items-center d-flex justify-content-evenly bg-primary border-0";
const FORM_HEADER_CLOSE_BUTTON_CLASS = 'btn rounded-5 px-5 py-2 bg-warning shadow-sm';
// --- End Styles & Classes ---

// --- Helpers ---
const parseCurrency = (value) => { if (value === null || value === undefined) return NaN; if (typeof value !== 'string') return Number(value) || 0; const cleaned = value.replace(/[\s\u00A0]/g, '').replace(/[^0-9,.-]/g, '').replace(',', '.'); const number = parseFloat(cleaned); return isNaN(number) ? NaN : number; };
const formatCurrency = (value, fallback = '-') => { const n = parseFloat(value); return isNaN(n) ? fallback : n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const formatDateSimple = (dateString) => { if (!dateString) return '-'; try { if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) { return new Date(dateString).toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }); } const d=new Date(dateString); return isNaN(d.getTime())?dateString:d.toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (e) { return dateString; } };
// --- End Helpers ---


const VersementPPForm = ({
    itemId = null, // Versement ID when editing
    onClose,
    onItemCreated,
    onItemUpdated,
    baseApiUrl = 'http://192.168.30.241:81/api'
}) => {
    // --- State ---
    const isEditing = useMemo(() => itemId !== null, [itemId]);
    const [formData, setFormData] = useState({ date_versement: '', montant_verse: '', moyen_paiement: '', reference_paiement: '', commentaire: '' });
    const [projectOptions, setProjectOptions] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [partnerOptions, setPartnerOptions] = useState([]);
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [engagementId, setEngagementId] = useState(null); // The crucial FK

    // State for engagement details (amount committed, total paid *by others* or total for the engagement)
    const [engagementInfo, setEngagementInfo] = useState({ montant_engage: null, total_deja_verse: null });
    const [loadingEngagementDetails, setLoadingEngagementDetails] = useState(false);

    // Loading and Status States
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [loadingPartners, setLoadingPartners] = useState(false);
    const [loadingData, setLoadingData] = useState(isEditing);
    const [submissionStatus, setSubmissionStatus] = useState({ loading: false, error: null, success: false });
    const [formErrors, setFormErrors] = useState({});

    // --- Fetch Initial Data ---
    const fetchProjects = useCallback(async () => { /* ... unchanged ... */ setLoadingProjects(true); try { const response = await axios.get(`${baseApiUrl}/projets`, { params: { perPage: 9999 }, withCredentials: true }); const projets = response.data?.projets || response.data || []; setProjectOptions(projets.map(p => ({ value: p.ID_Projet, label: `${p.Code_Projet} - ${p.Nom_Projet}` }))); } catch (err) { console.error("Erreur chargement Projets:", err); setSubmissionStatus(prev => ({ ...prev, error: "Erreur chargement projets." })); } finally { setLoadingProjects(false); } }, [baseApiUrl]);
    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    // Fetch Existing Versement Data (Edit Mode)
    useEffect(() => {
        if (!isEditing || !itemId || projectOptions.length === 0) { setLoadingData(false); return; }
        let isMounted = true;
        const fetchVersementData = async () => {
            setLoadingData(true);
            setSubmissionStatus({}); setFormErrors({}); setSelectedProject(null); setSelectedPartner(null); setPartnerOptions([]); setEngagementId(null); setEngagementInfo({ montant_engage: null, total_deja_verse: null });
            try {
                const response = await axios.get(`${baseApiUrl}/versementspp/${itemId}?include=engagementDetails`, { withCredentials: true });
                const data = response.data?.versement;
                const totalDejaVersePourEngagement = response.data?.total_deja_verse_pour_engagement;
                if (!data?.engagement_financier?.projet || !data?.engagement_financier?.partenaire || data?.engagement_financier?.montant_engage === undefined || totalDejaVersePourEngagement === undefined) { throw new Error("Données API incomplètes reçues."); }
                if (isMounted) {
                    const currentMontantVerse = parseCurrency(data.montant_verse ?? 0);
                    setFormData({ date_versement: data.date_versement?.split('T')[0] ?? '', montant_verse: String(data.montant_verse ?? ''), moyen_paiement: data.moyen_paiement ?? '', reference_paiement: data.reference_paiement ?? '', commentaire: data.commentaire ?? '' });
                    const initialProject = projectOptions.find(opt => String(opt.value) === String(data.engagement_financier.projet_id));
                    if (initialProject) {
                        setSelectedProject(initialProject);
                        const partner = data.engagement_financier.partenaire;
                        const partnerOption = { value: partner.Id, label: `${partner.Code ? partner.Code + ' - ' : ''}${partner.Description}` };
                        setPartnerOptions([partnerOption]); setSelectedPartner(partnerOption); setEngagementId(data.engagement_id);
                        const totalPaidByOthers = Math.max(0, (totalDejaVersePourEngagement ?? 0) - currentMontantVerse);
                        setEngagementInfo({ montant_engage: data.engagement_financier.montant_engage, total_deja_verse: totalPaidByOthers });
                    } else { throw new Error("Projet initial non trouvé."); }
                }
            } catch (err) { if (isMounted) { console.error("Erreur chargement Versement (Edit):", err); setSubmissionStatus({ loading: false, error: err.message || "Erreur chargement versement.", success: false }); } }
            finally { if (isMounted) setLoadingData(false); }
        };
        fetchVersementData();
        return () => { isMounted = false };
    }, [itemId, isEditing, baseApiUrl, projectOptions]);


    // --- Dynamic Loading Logic ---

    // Effect to fetch Partners (Only runs in CREATE mode now)
    useEffect(() => {
        if (isEditing || !selectedProject) { if(!selectedProject) { setPartnerOptions([]); setSelectedPartner(null); setEngagementId(null); setEngagementInfo({ montant_engage: null, total_deja_verse: null }); } return; }
        const projectId = selectedProject.value; let isMounted = true; const fetchPartners = async () => {
            setLoadingPartners(true); setPartnerOptions([]); setSelectedPartner(null); setEngagementId(null); setEngagementInfo({ montant_engage: null, total_deja_verse: null }); setFormErrors(prev => ({ ...prev, partenaire: undefined, engagement_id: undefined }));
            try { const url = `${baseApiUrl}/versementspp/project/${projectId}/engaged-partners`; const response = await axios.get(url, { withCredentials: true }); if (isMounted) { const partners = response.data?.partenaires || []; setPartnerOptions(partners.map(p => ({ value: p.Id, label: `${p.Code ? p.Code + ' - ' : ''}${p.Description}` }))); } } catch (err) { console.error(`Erreur chargement Partenaires Projet ${projectId}:`, err); if (isMounted) setSubmissionStatus(prev => ({ ...prev, error: "Erreur chargement partenaires." })); } finally { if (isMounted) setLoadingPartners(false); } };
        fetchPartners(); return () => { isMounted = false };
    }, [selectedProject, baseApiUrl, isEditing]);


    // Effect to fetch Engagement Details (ID, Amount, Total Paid)
    // ** REMOVED formData.montant_verse FROM DEPENDENCY ARRAY **
    useEffect(() => {
        if (isEditing && loadingData) return; // Don't run if editing and initial data is still loading
        if (!selectedProject || !selectedPartner) {
            // Clear engagement info if project/partner deselected (unless editing where they are fixed)
             if (!isEditing) {
                setEngagementId(null);
                setEngagementInfo({ montant_engage: null, total_deja_verse: null });
             }
            return;
        }

        const projectId = selectedProject.value;
        const partnerId = selectedPartner.value;
        let isMounted = true;

        const fetchEngagementDetails = async () => {
            setLoadingEngagementDetails(true);
             // Don't reset ID in edit mode, it's fixed. Reset if creating.
             if (!isEditing) {
                 setEngagementId(null);
             }
            setEngagementInfo({ montant_engage: null, total_deja_verse: null }); // Always reset details before fetch
            setFormErrors(prev => ({ ...prev, engagement_id: undefined }));

            try {
                const url = `${baseApiUrl}/versementspp/get-engagement-id`;
                const response = await axios.get(url, { params: { projet_id: projectId, partenaire_id: partnerId }, withCredentials: true });
                if (isMounted && response.data) {
                    const { engagement_id, montant_engage, total_deja_verse } = response.data;
                    if (engagement_id && montant_engage !== undefined && total_deja_verse !== undefined) {
                        setEngagementId(engagement_id);
                        // Store the raw total_deja_verse from API. Calculation for edit mode will happen elsewhere.
                        setEngagementInfo({ montant_engage: montant_engage, total_deja_verse: total_deja_verse ?? 0 });
                        setFormErrors(prev => ({...prev, montant_verse: undefined})); // Clear amount error on successful load
                    } else { throw new Error("Réponse API incomplète pour détails engagement."); }
                }
            } catch (err) { console.error(`Erreur chargement Détails Engagement Pjt ${projectId}/Prt ${partnerId}:`, err); if (isMounted) { const errorMsg = err.response?.status === 404 ? "Aucun engagement trouvé." : (err.message || "Erreur chargement détails."); setFormErrors(prev => ({ ...prev, engagement_id: errorMsg })); setEngagementInfo({ montant_engage: null, total_deja_verse: null }); } }
            finally { if (isMounted) setLoadingEngagementDetails(false); }
        };

        fetchEngagementDetails();
        return () => { isMounted = false };

    }, [selectedProject, selectedPartner, baseApiUrl, isEditing, loadingData, itemId]); // <-- formData.montant_verse REMOVED


    // --- Handlers ---
    // handleProjectChange, handlePartnerChange (Unchanged)
     const handleProjectChange = (selectedOption) => { if (isEditing) return; setSelectedProject(selectedOption); setSelectedPartner(null); setPartnerOptions([]); setEngagementId(null); setEngagementInfo({ montant_engage: null, total_deja_verse: null }); setFormErrors(prev => ({...prev, projet: undefined, partenaire: undefined, engagement_id: undefined })); };
     const handlePartnerChange = (selectedOption) => { if (isEditing) return; setSelectedPartner(selectedOption); setEngagementId(null); setEngagementInfo({ montant_engage: null, total_deja_verse: null }); setFormErrors(prev => ({...prev, partenaire: undefined, engagement_id: undefined })); };

    // handleChange - Frontend amount check remains useful for UX
    const handleChange = (e) => {
        const { name, value } = e.target;
        const newFormData = { ...formData, [name]: value };
        setFormData(newFormData);
        if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: undefined }));

        if (name === 'montant_verse' && engagementInfo.montant_engage !== null) {
            const montantEngage = parseFloat(engagementInfo.montant_engage);
            // Use the correct base 'total_deja_verse' depending on mode
            // In Edit mode, state.total_deja_verse ALREADY excludes current amount
            // In Create mode, state.total_deja_verse is the full total from API
            let totalPaidBase = engagementInfo.total_deja_verse !== null ? parseFloat(engagementInfo.total_deja_verse) : NaN;
            const montantActuel = parseCurrency(value);

            if (!isNaN(montantEngage) && !isNaN(totalPaidBase) && !isNaN(montantActuel)) {
                 const maxAutorise = montantEngage - totalPaidBase;
                 if (montantActuel > maxAutorise + 0.001) { setFormErrors(prev => ({ ...prev, montant_verse: `Dépasse le restant (${formatCurrency(maxAutorise)}).` })); }
                 else { setFormErrors(prev => ({...prev, montant_verse: undefined})); }
            } else if (!isNaN(montantActuel) && montantActuel < 0) { setFormErrors(prev => ({...prev, montant_verse: 'Montant doit être positif.'})); }
            else { setFormErrors(prev => ({...prev, montant_verse: undefined})); } // Clear error if input is invalid/empty
        }
    };

    // --- Frontend Validation --- (Unchanged)
    const validateForm = () => { const currentErrors = { ...formErrors }; if (!selectedProject) currentErrors.projet = "Projet requis."; if (!selectedPartner) currentErrors.partenaire = "Partenaire requis."; if (!engagementId && !loadingEngagementDetails && selectedProject && selectedPartner) { currentErrors.engagement_id = currentErrors.engagement_id || "Engagement non trouvé/chargé."; } else if (!engagementId && selectedProject && selectedPartner) { currentErrors.engagement_id = currentErrors.engagement_id || "Engagement non identifié."; } if (!formData.date_versement) currentErrors.date_versement = "Date versement requise."; const montantNum = parseCurrency(formData.montant_verse); const montantValide = !isNaN(montantNum) && montantNum > 0; if (!formData.montant_verse || !montantValide) { currentErrors.montant_verse = currentErrors.montant_verse || "Montant valide (positif) requis."; } if (!formData.moyen_paiement?.trim()) currentErrors.moyen_paiement = "Moyen de paiement requis."; setFormErrors(currentErrors); return Object.values(currentErrors).every(error => !error); };

    // --- Submit Handler --- (Unchanged)
    const handleSubmit = async (e) => { e.preventDefault(); if (!validateForm()) { setSubmissionStatus({ loading: false, error: "Veuillez corriger les erreurs.", success: false }); return; } if (!engagementId) { setSubmissionStatus({ loading: false, error: "ID engagement manquant.", success: false }); setFormErrors(prev => ({ ...prev, engagement_id: "Engagement non identifié." })); return; } setSubmissionStatus({ loading: true, error: null, success: false }); setFormErrors({}); const dataToSubmit = { engagement_id: engagementId, date_versement: formData.date_versement, montant_verse: parseCurrency(formData.montant_verse), moyen_paiement: formData.moyen_paiement, reference_paiement: formData.reference_paiement || null, commentaire: formData.commentaire || null }; const url = isEditing ? `${baseApiUrl}/versementspp/${itemId}` : `${baseApiUrl}/versementspp`; const method = isEditing ? 'put' : 'post'; const config = { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, withCredentials: true }; try { const response = await axios[method](url, dataToSubmit, config); setSubmissionStatus({ loading: false, error: null, success: true }); if (isEditing) { onItemUpdated?.(response.data.versement); } else { onItemCreated?.(response.data.versement); } } catch (err) { console.error(`Erreur ${isEditing ? 'modif.' : 'création'} versement:`, err.response || err); let errorMsg = `Une erreur s'est produite.`; let serverErrors = {}; if (err.response) { errorMsg = err.response.data?.message || `Erreur serveur (${err.response.status})`; if (err.response.status === 422 && typeof err.response.data.errors === 'object') { serverErrors = err.response.data.errors; const mappedErrors = {}; Object.keys(serverErrors).forEach(key => { mappedErrors[key] = serverErrors[key].join(' '); }); setFormErrors(mappedErrors); errorMsg = "Erreurs de validation serveur."; } } else { errorMsg = err.message; } setSubmissionStatus({ loading: false, error: errorMsg, success: false }); } };

    // --- Render Logic ---
    const isLoading = loadingData || loadingProjects || loadingPartners || loadingEngagementDetails;
    const isSubmitButtonDisabled = isLoading || submissionStatus.loading || !engagementId || !!formErrors.montant_verse;

    // ** Calculate remaining amount for display directly here **
    const montantEngageNum = engagementInfo.montant_engage !== null ? parseFloat(engagementInfo.montant_engage) : NaN;
    // total_deja_verse state already holds the correct base (total paid by others in edit, total paid in create)
    const totalDejaVerseBaseNum = engagementInfo.total_deja_verse !== null ? parseFloat(engagementInfo.total_deja_verse) : NaN;
    let montantRestantAffichage = NaN; // For display under the info box
    let maxVersementPossible = NaN; // For input max/helper text

    if (!isNaN(montantEngageNum) && !isNaN(totalDejaVerseBaseNum)) {
         montantRestantAffichage = montantEngageNum - totalDejaVerseBaseNum;
         // If editing, the "max possible for this payment" IS the remaining amount calculated this way
         // If creating, it's the same.
         maxVersementPossible = montantRestantAffichage;
    }
    // --- End Calculation ---


     if (loadingData || loadingProjects) { // Show overlay during initial load
         return <div className="d-flex justify-content-center align-items-center p-5" style={{ minHeight: '400px' }}><Spinner /> <span className='ms-3 text-muted'>Chargement...</span></div>;
     }

    return (
        <div className={FORM_CONTAINER_CLASS} style={{ backgroundColor: '#fff', borderRadius: '20px', boxShadow: '0 6px 18px rgba(0,0,0,0.1)', maxHeight: 'calc(90vh - 100px)', overflowY: 'auto' }}>
             {/* Header */}
             <div className="d-flex justify-content-between align-items-center mb-4 flex-shrink-0"><div><h5 className="text-uppercase fw-bold text-secondary mb-1">{isEditing ? 'Modifier' : 'Ajouter'}</h5><h2 className="mb-0 fw-bold">Versement</h2></div><Button variant="light" className={FORM_HEADER_CLOSE_BUTTON_CLASS} onClick={onClose} size="sm"><b>Retour Liste</b></Button></div>

            {/* Form Content */}
            <div className="flex-grow-1">
                {/* Status Alerts */}
                 {submissionStatus.error && ( <Alert variant="danger" className="mb-3 py-2" dismissible onClose={() => setSubmissionStatus(prev => ({...prev, error: null}))}><FontAwesomeIcon icon={faExclamationTriangle} className="me-2"/> {submissionStatus.error}</Alert> )}
                 {submissionStatus.success && ( <Alert variant="success" className="mb-3 py-2">Versement {isEditing ? 'modifié' : 'ajouté'} !</Alert> )}

                <Form noValidate onSubmit={handleSubmit}>
                    {/* === Section 1: Project & Partner Selection === */}
                     <h5 className="mb-3 mt-4 fw-semibold text-warning border-bottom pb-2">Engagement Associé</h5>
                     {/* Project/Partner Selects (Unchanged JSX) */}
                     <Row className="mb-3 g-3">
                         <Col md={6}><Form.Group controlId="formProjet"><Form.Label className="small mb-1 fw-medium">Projet <span className="text-danger">*</span></Form.Label><Select name="projet" options={projectOptions} value={selectedProject} onChange={handleProjectChange} styles={selectStyles} placeholder="- Sélectionner Projet -" isClearable isLoading={loadingProjects} isDisabled={loadingProjects || isEditing} className={formErrors.projet ? 'is-invalid' : ''} classNamePrefix="react-select"/>{formErrors.projet && <div className="invalid-feedback d-block ps-1 small">{formErrors.projet}</div>}{isEditing && <Form.Text className="text-muted small ms-1">Projet non modifiable.</Form.Text>}</Form.Group></Col>
                         <Col md={6}><Form.Group controlId="formPartenaire"><Form.Label className="small mb-1 fw-medium">Partenaire <span className="text-danger">*</span></Form.Label><Select name="partenaire" options={partnerOptions} value={selectedPartner} onChange={handlePartnerChange} styles={selectStyles} placeholder={loadingPartners ? "Chargement..." : (selectedProject ? "- Sélectionner Partenaire -" : "Choisir Projet")} isClearable isLoading={loadingPartners} isDisabled={!selectedProject || loadingPartners || isEditing} className={formErrors.partenaire ? 'is-invalid' : ''} classNamePrefix="react-select"/>{formErrors.partenaire && <div className="invalid-feedback d-block ps-1 small">{formErrors.partenaire}</div>}{isEditing && <Form.Text className="text-muted small ms-1">Partenaire non modifiable.</Form.Text>}</Form.Group></Col>
                    </Row>
                     {/* Display Engagement Info/Status */}
                     <Row className="mb-3 g-3">
                         <Col>
                              {loadingEngagementDetails && ( <div className="text-muted small d-flex align-items-center"><Spinner size="sm" animation="border" className="me-2" /> Recherche engagement...</div> )}
                              {!loadingEngagementDetails && engagementId && engagementInfo.montant_engage !== null && (
                                <Alert variant="light" className="py-2 px-3 d-flex justify-content-between align-items-center flex-wrap border shadow-sm">
                                     <div className='me-3 mb-1 mb-md-0 small'><FontAwesomeIcon icon={faStickyNote} className="me-1 text-secondary"/> Engagement ID: <strong>{engagementId}</strong></div>
                                     <div className='me-3 mb-1 mb-md-0 small'>Montant Engagé: <strong>{formatCurrency(engagementInfo.montant_engage)}</strong></div>
                                     {/* Display Montant Restant calculated in render */}
                                     {!isNaN(montantRestantAffichage) && ( <div className='small'>Montant Restant: <strong className={montantRestantAffichage < 0.01 ? 'text-success' : 'text-primary'}>{formatCurrency(montantRestantAffichage)}</strong></div> )}
                                </Alert>
                             )}
                             {formErrors.engagement_id && ( <Alert variant="danger" size="sm" className="py-1 px-3"><FontAwesomeIcon icon={faExclamationTriangle} className="me-2"/> {formErrors.engagement_id}</Alert> )}
                         </Col>
                    </Row>

                    {/* === Section 2: Versement Details === */}
                    <h5 className="mb-3 mt-4 fw-semibold text-warning border-bottom pb-2">Détails du Versement</h5>
                     <Row className="mb-1 g-3">
                         <Form.Group as={Col} md={4} controlId="formDateVersement"><Form.Label className="small mb-1 fw-medium">Date Versement <span className="text-danger">*</span></Form.Label><Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.date_versement} required type="date" name="date_versement" value={formData.date_versement} onChange={handleChange} size="sm"/><Form.Control.Feedback type="invalid">{formErrors.date_versement}</Form.Control.Feedback></Form.Group>
                         <Form.Group as={Col} md={4} controlId="formMontantVerse"><Form.Label className="small mb-1 fw-medium">Montant Versé (MAD) <span className="text-danger">*</span></Form.Label><Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.montant_verse} required type="number" name="montant_verse" value={formData.montant_verse} onChange={handleChange} size="sm" step="0.01" min="0.01" disabled={!engagementId || loadingEngagementDetails} // Suggest max amount - this doesn't strictly enforce it max={!isNaN(maxVersementPossible) && maxVersementPossible >= 0.01 ? maxVersementPossible.toFixed(2) : undefined}
                            /><Form.Control.Feedback type="invalid">{formErrors.montant_verse}</Form.Control.Feedback>{!isNaN(maxVersementPossible) && !formErrors.montant_verse && maxVersementPossible >=0 && ( <Form.Text className="text-muted small ms-1">Max possible: {formatCurrency(maxVersementPossible)}</Form.Text> )}</Form.Group>
                         <Form.Group as={Col} md={4} controlId="formMoyenPaiement"><Form.Label className="small mb-1 fw-medium">Moyen de Paiement <span className="text-danger">*</span></Form.Label><Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.moyen_paiement} required type="text" name="moyen_paiement" value={formData.moyen_paiement} onChange={handleChange} size="sm" maxLength={50}/><Form.Control.Feedback type="invalid">{formErrors.moyen_paiement}</Form.Control.Feedback></Form.Group>
                     </Row>
                     <Row className="mb-1 g-3"><Form.Group as={Col} md={12} controlId="formReferencePaiement"><Form.Label className="small mb-1 fw-medium">Référence Paiement</Form.Label><Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.reference_paiement} type="text" name="reference_paiement" value={formData.reference_paiement} onChange={handleChange} size="sm" maxLength={100}/><Form.Control.Feedback type="invalid">{formErrors.reference_paiement}</Form.Control.Feedback></Form.Group></Row>
                     <Row className="mb-3 g-3"><Form.Group as={Col} md={12} controlId="formCommentaire"><Form.Label className="small mb-1 fw-medium">Commentaire</Form.Label><Form.Control className={FORM_TEXTAREA_CLASS} style={{borderRadius: '1rem'}} as="textarea" rows={3} name="commentaire" value={formData.commentaire} onChange={handleChange} size="sm"/><Form.Control.Feedback type="invalid">{formErrors.commentaire}</Form.Control.Feedback></Form.Group></Row>

                    {/* Action Buttons */}
                    <Row className={FORM_ACTIONS_ROW_CLASS}>
                        <Col xs="auto" className="pe-2"><Button onClick={onClose} variant="secondary" className={FORM_CANCEL_BUTTON_CLASS} disabled={submissionStatus.loading}>Annuler</Button></Col>
                        <Col xs="auto" className="ps-2"><Button type="submit" className={FORM_SUBMIT_BUTTON_CLASS} disabled={isSubmitButtonDisabled}>{submissionStatus.loading ? <><Spinner as="span" animation="border" size="sm" className="me-2"/> Enregistrement...</> : (isEditing ? 'Enregistrer Modifs' : 'Créer Versement')}</Button></Col>
                    </Row>
                </Form>
            </div>
        </div>
    );
};

// --- PropTypes & Default Props --- (Unchanged)
VersementPPForm.propTypes = { itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), onClose: PropTypes.func.isRequired, onItemCreated: PropTypes.func, onItemUpdated: PropTypes.func, baseApiUrl: PropTypes.string };
VersementPPForm.defaultProps = { itemId: null, onItemCreated: (v) => console.log("Versement Created:", v), onItemUpdated: (v) => console.log("Versement Updated:", v), baseApiUrl: 'http://192.168.30.241:81/api' };

export default VersementPPForm;