// src/pages/projets_views/ProjetForm.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faExclamationTriangle, faTimes, faTrashAlt, faPlusCircle, faUserPlus
} from '@fortawesome/free-solid-svg-icons';
import Select from 'react-select';
import {
    Form, Button, Row, Col, Alert, Spinner, Card, InputGroup, FormCheck, ListGroup, Badge, Stack, Modal
} from 'react-bootstrap';
import PropTypes from 'prop-types';

// --- Styles & Classes ---
const selectStyles = { /* Your existing selectStyles */
    control: (provided, state) => ({ ...provided, backgroundColor: '#f8f9fa', borderRadius: '1.5rem', border: state.isFocused ? '1px solid #86b7fe' : '1px solid #ced4da', boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : 'none', minHeight: '38px', }), valueContainer: (provided) => ({ ...provided, padding: '0.25rem 0.8rem', }), input: (provided) => ({ ...provided, margin: '0px', padding: '0px', }), indicatorSeparator: () => ({ display: 'none', }), indicatorsContainer: (provided) => ({ ...provided, padding: '1px', }), placeholder: (provided) => ({ ...provided, color: '#6c757d', }), menu: (provided) => ({ ...provided, borderRadius: '0.5rem', boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)', zIndex: 1050 }), option: (provided, state) => ({ ...provided, backgroundColor: state.isSelected ? '#0d6efd' : state.isFocused ? '#e9ecef' : null, color: state.isSelected ? 'white' : 'black', }),
};
const FORM_CONTAINER_CLASS = "p-3 p-md-4 projet-form-container";
const FORM_CONTROL_CLASS = "p-2 mt-1 mb-3 rounded-pill shadow-sm bg-light border";
const FORM_TEXTAREA_CLASS = "p-2 mt-1 mb-3 rounded shadow-sm bg-light border";
const FORM_ACTIONS_ROW_CLASS = "mt-4 pt-2 justify-content-center flex-shrink-0";
const FORM_CANCEL_BUTTON_CLASS = "btn px-5 rounded-5 py-1 bg-danger border-0";
const FORM_SUBMIT_BUTTON_CLASS = "btn rounded-5 px-5 py-1 align-items-center d-flex justify-content-evenly bg-primary border-0";
const FORM_HEADER_CLOSE_BUTTON_CLASS = 'btn rounded-5 px-5 py-2 bg-warning shadow-sm';
// --- End Styles & Classes ---

// --- Helpers ---
const parseCurrency = (value) => {
    if (typeof value !== 'string') return Number(value) || 0;
    const cleaned = value.replace(/[\s\u00A0]/g, '').replace(/[^0-9,.-]/g, '').replace(',', '.');
    const number = parseFloat(cleaned);
    return isNaN(number) ? 0 : number;
};
const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
const safeParseInt = (value) => {
    if (value === null || value === undefined) return null;
    const parsed = parseInt(String(value), 10);
    return Number.isInteger(parsed) ? parsed : null;
};
// --- End Helpers ---


const ProjetForm = ({
    itemId = null, // ID_Projet when editing
    onClose,
    onItemCreated,
    onItemUpdated,
    baseApiUrl = 'http://localhost:8000/api'
}) => {
    // --- State ---
    // Main Project Data
    const [formData, setFormData] = useState({
        Code_Projet: '', Nom_Projet: '', Cout_CRO: '', Date_Debut: '', Observations: '',
        Etat_Avan_Physi: '', Date_Fin: '', Cout_Projet: '',
        domaine: null, programme: null, chantier: null, convention: null,
    });

    // Engagements Section
    const [partenaireOptions, setPartenaireOptions] = useState([]); // <-- Holds partner options for Select
    const [currentEngagement, setCurrentEngagement] = useState({
        partenaire: null, montant_engage: '', date_engagement: '', est_formalise: false, commentaire: ''
    });
    const [engagementsList, setEngagementsList] = useState([]);

    // Other States
    const isEditing = useMemo(() => itemId !== null, [itemId]);
    const [domaineOptions, setDomaineOptions] = useState([]);
    const [programmeOptions, setProgrammeOptions] = useState([]);
    const [chantierOptions, setChantierOptions] = useState([]);
    const [conventionOptions, setConventionOptions] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState({ domaines: true, programmes: true, chantiers: true, conventions: true, partenaires: true });
    const [submissionStatus, setSubmissionStatus] = useState({ loading: false, error: null, success: false });
    const [formErrors, setFormErrors] = useState({});
    const [engagementErrors, setEngagementErrors] = useState({});
    const [loadingData, setLoadingData] = useState(isEditing);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmModalData, setConfirmModalData] = useState({ message: '', details: [] });
    const [dataToResubmit, setDataToResubmit] = useState(null);


    // --- Fetch Options (including Partenaires) ---
    const fetchOptions = useCallback(async () => {
         setLoadingOptions({ domaines: true, programmes: true, chantiers: true, conventions: true, partenaires: true });
        try {
            const [domRes, progRes, chanRes, convRes, partRes] = await Promise.all([
                axios.get(`${baseApiUrl}/domaines`, { withCredentials: true }),
                axios.get(`${baseApiUrl}/programmes`, { withCredentials: true }),
                axios.get(`${baseApiUrl}/chantiers`, { withCredentials: true }),
                axios.get(`${baseApiUrl}/conventions`, { withCredentials: true }),
                axios.get(`${baseApiUrl}/partenaires`, { withCredentials: true }) // Fetch partners
            ]);

            // Process standard options
            setDomaineOptions((domRes.data.domaines || []).map(d => ({ value: d.Code, label: d.Description })));
            setProgrammeOptions((progRes.data.programmes || []).map(p => ({ value: p.Code_Programme, label: `${p.Code_Programme} - ${p.Description}` })));
            setChantierOptions((chanRes.data.chantiers || []).map(c => ({ value: c.Code_Chantier, label: `${c.Code_Chantier} - ${c.Description}` })));
            setConventionOptions((convRes.data.conventions || []).map(c => ({ value: c.Code, label: `${c.Code} - ${c.Intitule}` })));

            // *** FIXED: Process Partner Options using the correct label field ***
            const partnerData = partRes.data.partenaires || partRes.data || [];
            console.log("Raw Partner API Response Data:", partnerData); // Log raw data
            const mappedPartnerOptions = partnerData.map(p => ({
                value: p.Id, // Use 'Id' from your API response
                // Prioritize Description_Arr, then Description, then fallback to Code
                label: p.Description_Arr || p.Description || `Partenaire Code ${p.Code}`
            }));
            console.log("Mapped Partner Options for Select:", mappedPartnerOptions); // Log mapped data
            setPartenaireOptions(mappedPartnerOptions); // Update state

        } catch (err) { console.error("Erreur chargement options:", err); setSubmissionStatus(prev => ({ ...prev, error: "Erreur chargement des listes." })); }
        finally { setLoadingOptions({ domaines: false, programmes: false, chantiers: false, conventions: false, partenaires: false }); }
    }, [baseApiUrl]);

    useEffect(() => { fetchOptions(); }, [fetchOptions]);


    // --- Fetch Existing Data (Edit Mode) ---
    useEffect(() => {
        const optionsFinished = !loadingOptions.domaines && !loadingOptions.programmes && !loadingOptions.chantiers && !loadingOptions.conventions && !loadingOptions.partenaires;
        if (!isEditing || !optionsFinished) {
            setLoadingData(false); return;
        }

        let isMounted = true;
        const fetchProjetData = async () => {
            setLoadingData(true);
            setSubmissionStatus({}); setFormErrors({}); setEngagementErrors({}); setEngagementsList([]);
            setCurrentEngagement({partenaire: null, montant_engage: '', date_engagement: '', est_formalise: false, commentaire: ''});
            setDataToResubmit(null); setShowConfirmModal(false);

            try {
                const response = await axios.get(`${baseApiUrl}/projets/${itemId}`, { withCredentials: true });
                const data = response.data?.projet || response.data;
                if (!data || !isMounted) return;

                const findOption = (options, value) => options?.find(opt => String(opt.value) === String(value)) || null;

                setFormData({
                    Code_Projet: data.Code_Projet ?? '',
                    Nom_Projet: String(data.Nom_Projet ?? ''),
                    Cout_CRO: data.Cout_CRO ?? '',
                    Date_Debut: data.Date_Debut?.split('T')[0] ?? '',
                    Observations: data.Observations ?? '',
                    Etat_Avan_Physi: data.Etat_Avan_Physi ?? '',
                    Date_Fin: data.Date_Fin?.split('T')[0] ?? '',
                    Cout_Projet: data.Cout_Projet ?? '',
                    domaine: findOption(domaineOptions, data.Id_Domaine),
                    programme: findOption(programmeOptions, data.Id_Programme),
                    chantier: findOption(chantierOptions, data.Id_Chantier),
                    convention: findOption(conventionOptions, data.Convention_Code),
                });

                const fetchedEngagements = data.engagements_financiers || [];
                setEngagementsList(fetchedEngagements.map(eng => ({
                    id: safeParseInt(eng.id),
                    tempId: generateTempId(),
                    partenaire: findOption(partenaireOptions, eng.partenaire_id), // Use fetched partenaireOptions
                    montant_engage: String(eng.montant_engage ?? ''),
                    date_engagement: eng.date_engagement?.split('T')[0] ?? '',
                    est_formalise: !!eng.est_formalise,
                    commentaire: eng.commentaire ?? ''
                })));

            } catch (err) {
                 if (isMounted) {
                    console.error("Erreur chargement projet existant:", err);
                    setSubmissionStatus({ loading: false, error: err.response?.data?.message || err.message || "Erreur chargement du projet.", success: false });
                 }
            } finally {
                 if (isMounted) setLoadingData(false);
            }
        };

        fetchProjetData();
        return () => { isMounted = false; };
    }, [itemId, isEditing, baseApiUrl, loadingOptions, domaineOptions, programmeOptions, chantierOptions, conventionOptions, partenaireOptions]); // Added partenaireOptions


    // --- Reset Form (Create Mode) ---
    useEffect(() => {
        const optionsFinished = !loadingOptions.domaines && !loadingOptions.programmes && !loadingOptions.chantiers && !loadingOptions.conventions && !loadingOptions.partenaires;
        if (!isEditing && optionsFinished) {
            setFormData({ Code_Projet: '', Nom_Projet: '', Cout_CRO: '', Date_Debut: '', Observations: '', Etat_Avan_Physi: '', Date_Fin: '', Cout_Projet: '', domaine: null, programme: null, chantier: null, convention: null, });
            setEngagementsList([]);
            setCurrentEngagement({ partenaire: null, montant_engage: '', date_engagement: '', est_formalise: false, commentaire: '' });
            setFormErrors({}); setEngagementErrors({}); setSubmissionStatus({}); setLoadingData(false);
            setDataToResubmit(null); setShowConfirmModal(false);
        }
    }, [isEditing, loadingOptions]);


    // --- Frontend Validation ---
    const validateForm = () => {
        const errors = {};
        if (!formData.Code_Projet || String(formData.Code_Projet).trim() === '') errors.Code_Projet = "Code Projet requis.";
        if (!formData.Nom_Projet?.trim()) errors.Nom_Projet = "Nom Projet requis.";
        if (!formData.domaine) errors.Id_Domaine = "Domaine requis.";
        if (!formData.programme) errors.Id_Programme = "Programme requis.";
        if (!formData.chantier) errors.Id_Chantier = "Chantier requis.";
        // if (!formData.convention) errors.Convention_Code = "Convention requise.";
        // if (!formData.Date_Debut) errors.Date_Debut = "Date début requise.";
        // if (formData.Date_Fin && formData.Date_Debut && formData.Date_Fin < formData.Date_Debut) errors.Date_Fin = "Date fin doit être après date début.";
        const checkNumeric = (field, name) => { const v = formData[field]; if (isNaN(parseCurrency(v)) || parseCurrency(v) < 0) errors[field] = `${name} requis/numérique positif.`; };
        checkNumeric('Cout_CRO', 'Coût CRO');
        checkNumeric('Cout_Projet', 'Coût Projet');
        const checkPercent = (field, name) => { const v = formData[field]; if (  isNaN(parseCurrency(v)) || parseCurrency(v) < 0 || parseCurrency(v) > 100) errors[field] = `${name} doit etre  entre(0-100).`; };
        checkPercent('Etat_Avan_Physi', '% Av. Physique');
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };
    const validateCurrentEngagement = () => {
         const errors = {};
         if (!currentEngagement.partenaire) errors.partenaire = "Partenaire requis.";
         if (!currentEngagement.montant_engage || isNaN(parseCurrency(currentEngagement.montant_engage)) || parseCurrency(currentEngagement.montant_engage) < 0) errors.montant_engage = "Montant valide requis.";
         if (!currentEngagement.date_engagement) errors.date_engagement = "Date engagement requise.";
         setEngagementErrors(errors);
         return Object.keys(errors).length === 0;
    };


    // --- Handlers ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: undefined }));
    };
    const handleDomaineChange = (selectedOption) => { setFormData(prev => ({ ...prev, domaine: selectedOption })); if (formErrors.Id_Domaine) setFormErrors(prev => ({ ...prev, Id_Domaine: undefined })); };
    const handleProgrammeChange = (selectedOption) => { setFormData(prev => ({ ...prev, programme: selectedOption })); if (formErrors.Id_Programme) setFormErrors(prev => ({ ...prev, Id_Programme: undefined })); };
    const handleChantierChange = (selectedOption) => { setFormData(prev => ({ ...prev, chantier: selectedOption })); if (formErrors.Id_Chantier) setFormErrors(prev => ({ ...prev, Id_Chantier: undefined })); };
    const handleConventionChange = (selectedOption) => { setFormData(prev => ({ ...prev, convention: selectedOption })); if (formErrors.Convention_Code) setFormErrors(prev => ({ ...prev, Convention_Code: undefined })); };
    const handleEngagementChange = (e) => {
        const { name, value, type, checked } = e.target;
        setCurrentEngagement(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (engagementErrors[name]) setEngagementErrors(prev => ({ ...prev, [name]: undefined }));
    };
    const handleEngagementPartnerChange = (selectedOption) => {
         setCurrentEngagement(prev => ({ ...prev, partenaire: selectedOption }));
         if (engagementErrors.partenaire) setEngagementErrors(prev => ({ ...prev, partenaire: undefined }));
    };
    const handleAddEngagement = () => {
        if (!validateCurrentEngagement()) return;
        if (currentEngagement.partenaire && engagementsList.some(eng => eng.partenaire?.value === currentEngagement.partenaire?.value)) {
             setEngagementErrors(prev => ({ ...prev, partenaire: "Ce partenaire a déjà un engagement dans la liste." }));
             return;
        }
        setEngagementsList(prev => [...prev, { id: null, tempId: generateTempId(), ...currentEngagement }]);
        setCurrentEngagement({ partenaire: null, montant_engage: '', date_engagement: '', est_formalise: false, commentaire: '' });
        setEngagementErrors({});
        if (formErrors.engagements) setFormErrors(prev => ({ ...prev, engagements: undefined }));
    };
    const handleRemoveEngagement = (tempIdToRemove) => {
        setEngagementsList(prev => prev.filter(eng => eng.tempId !== tempIdToRemove));
    };


    // --- Submit Handler (Refactored for Confirmation) ---
    const executeSubmit = async (dataPayload, confirmDelete = false) => {
        setSubmissionStatus({ loading: true, error: null, success: false });
        setFormErrors({});
        setDataToResubmit(null);

        const url = isEditing ? `${baseApiUrl}/projets/${itemId}` : `${baseApiUrl}/projets`;
        const method = isEditing ? 'put' : 'post'; // Correct method for PUT

        const finalPayload = {
            ...dataPayload,
            ...(confirmDelete && { confirm_cascade_delete: true })
        };

        const config = {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            withCredentials: true
        };

        console.log(`Submitting ${method.toUpperCase()} request to ${url}. Confirmation flag: ${confirmDelete}. Payload:`, finalPayload);

        try {
            // Use the correct axios method
            const response = await axios({
                 method: method, // Use 'put' or 'post'
                 url: url,
                 data: finalPayload,
                 headers: config.headers,
                 withCredentials: config.withCredentials,
             });

            console.log("API Response:", response.data);
            setSubmissionStatus({ loading: false, error: null, success: true });

            const returnedProjet = response.data.projet;
            if (isEditing) {
                onItemUpdated?.(returnedProjet);
                 if (returnedProjet?.engagements_financiers) {
                    const findOption = (options, value) => options?.find(opt => String(opt.value) === String(value)) || null;
                    setEngagementsList(returnedProjet.engagements_financiers.map(eng => ({
                        id: safeParseInt(eng.id),
                        tempId: generateTempId(),
                        partenaire: findOption(partenaireOptions, eng.partenaire_id),
                        montant_engage: String(eng.montant_engage ?? ''),
                        date_engagement: eng.date_engagement?.split('T')[0] ?? '',
                        est_formalise: !!eng.est_formalise,
                        commentaire: eng.commentaire ?? ''
                    })));
                 }
            } else {
                onItemCreated?.(returnedProjet);
            }
            // setTimeout(onClose, 1500); // Close only on explicit action or leave open

        } catch (err) {
            console.error(`Erreur ${isEditing ? 'modif.' : 'création'} (${method}):`, err.response || err);
            let errorMsg = `Une erreur s'est produite lors de la soumission.`;
            let serverErrors = {};

            if (err.response) {
                if (err.response.status === 409 && err.response.data?.requires_confirmation) {
                    console.log("Confirmation required from backend.");
                    setSubmissionStatus({ loading: false, error: null, success: false });
                    setConfirmModalData({ message: err.response.data.message || "Confirmation requise.", details: err.response.data.details || [] });
                    setDataToResubmit(dataPayload);
                    setShowConfirmModal(true);
                    return;
                }
                errorMsg = err.response.data?.message || `Erreur serveur (${err.response.status})`;
                if (err.response.status === 422 && typeof err.response.data.errors === 'object') {
                       serverErrors = err.response.data.errors;
                       const mappedErrors = {}; let generalEngagementError = '';
                       Object.keys(serverErrors).forEach(key => {
                           const errorMessages = serverErrors[key].join(' ');
                           if (key.startsWith('engagements.')) { generalEngagementError += errorMessages + ' '; }
                           else { mappedErrors[key] = errorMessages; }
                       });
                       if(generalEngagementError) mappedErrors['engagements'] = generalEngagementError.trim();
                       setFormErrors(mappedErrors);
                       errorMsg = "Erreurs de validation. Veuillez vérifier les champs indiqués.";
                }
            } else if (err.request) { errorMsg = "Aucune réponse du serveur. Vérifiez la connexion."; }
            else { errorMsg = err.message; }
            setSubmissionStatus({ loading: false, error: errorMsg, success: false });
        }
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        setShowConfirmModal(false);
        if (!validateForm()) {
            setSubmissionStatus({ loading: false, error: "Veuillez corriger les erreurs du formulaire Projet.", success: false });
            return;
        }
        const dataToSubmit = {
            Code_Projet: formData.Code_Projet, Nom_Projet: formData.Nom_Projet,
            Cout_CRO: parseCurrency(formData.Cout_CRO), Date_Debut: formData.Date_Debut,
            Observations: formData.Observations ?? '', Etat_Avan_Physi: parseCurrency(formData.Etat_Avan_Physi)??'',
            Date_Fin: formData.Date_Fin || null, Cout_Projet: parseCurrency(formData.Cout_Projet),
            Id_Domaine: formData.domaine?.value ?? null, Id_Programme: formData.programme?.value ?? null,
            Id_Chantier: formData.chantier?.value ?? null, Convention_Code: formData.convention?.value ?? null,
            engagements: engagementsList.map(eng => {
                let newObj = {
                    partenaire_id: safeParseInt(eng.partenaire?.value), montant_engage: parseCurrency(eng.montant_engage),
                    date_engagement: eng.date_engagement, est_formalise: eng.est_formalise, commentaire: eng.commentaire ?? ''
                };
                const parsedId = safeParseInt(eng.id); // Get DB ID if it exists
                if(parsedId !== null ) { newObj.id = parsedId; } // Only add 'id' if it's an existing engagement
                return newObj;
            })
        };
        executeSubmit(dataToSubmit, false);
    };


    // --- Confirmation Modal Handlers ---
    const handleModalConfirm = () => {
        setShowConfirmModal(false);
        if (dataToResubmit) {
            console.log("User confirmed cascade delete. Resubmitting...");
            executeSubmit(dataToResubmit, true); // Resubmit with confirmation flag
        } else {
            console.error("Cannot resubmit confirmation, dataToResubmit is null.");
            setSubmissionStatus({ loading: false, error: "Erreur interne: Impossible de confirmer.", success: false });
        }
    };
    const handleModalCancel = () => { setShowConfirmModal(false); setDataToResubmit(null); console.log("User cancelled cascade delete."); };


    // --- Render Logic ---
    const areOptionsLoading = Object.values(loadingOptions).some(isLoading => isLoading === true);
    const isSubmitDisabled = submissionStatus.loading || areOptionsLoading || loadingData;

    if (loadingData && isEditing) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /><span className='ms-3 text-muted'>Chargement...</span></div>;
    if (areOptionsLoading) return <div className={FORM_CONTAINER_CLASS} style={{ minHeight: '400px', display:'flex', justifyContent: 'center', alignItems: 'center' }}><Spinner animation="border" variant="primary" /><span className='ms-3 text-muted'>Chargement listes...</span></div>;

    return (
        <>
            <div className={FORM_CONTAINER_CLASS} style={{ backgroundColor: '#fff', borderRadius: '20px', boxShadow: '0 6px 18px rgba(0,0,0,0.1)', maxHeight: 'calc(90vh - 100px)', overflowY: 'auto' }}>
                {/* Header */}
                <div className="d-flex justify-content-between align-items-center mb-4 flex-shrink-0">
                    <div>
                        <h5 className="text-uppercase fw-bold text-secondary mb-1">{isEditing ? 'Modifier le' : 'Créer un nouveau'}</h5>
                        <h2 className="mb-0 fw-bold">Projet {isEditing && formData.Code_Projet ? `(Code: ${formData.Code_Projet})` : ''}</h2>
                    </div>
                    <Button variant="light" className={FORM_HEADER_CLOSE_BUTTON_CLASS} onClick={onClose} size="sm"><b>Revenir à la liste</b></Button>
                </div>
                {/* Form Content */}
                <div className="flex-grow-1">
                    {submissionStatus.error && ( <Alert variant="danger" className="mb-3 py-2 d-flex align-items-center" dismissible onClose={() => setSubmissionStatus(prev => ({...prev, error: null}))}> <FontAwesomeIcon icon={faExclamationTriangle} className="me-2 flex-shrink-0"/> <div>{submissionStatus.error}</div> </Alert> )}
                    {submissionStatus.success && ( <Alert variant="success" className="mb-3 py-2"> Projet {isEditing ? 'modifié' : 'créé'} avec succès ! </Alert> )}
                    <Form noValidate onSubmit={handleSubmit}>
                        {/* === Main Project Fields === */}
                        <h5 className="mb-3 mt-4 fw-semibold text-warning border-bottom pb-2">Détails du Projet</h5>
                        <Row className="mb-1 g-3">
                            <Form.Group as={Col} md={6} controlId="formCodeProjet"><Form.Label className="small mb-1 fw-medium">Code <span className="text-danger">*</span></Form.Label><Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Code_Projet} required type="text" name="Code_Projet" value={formData.Code_Projet} onChange={handleChange} size="sm"/><Form.Control.Feedback type="invalid">{formErrors.Code_Projet}</Form.Control.Feedback></Form.Group>
                            <Form.Group as={Col} md={6} controlId="formNomProjet"><Form.Label className="small mb-1 fw-medium">Nom <span className="text-danger">*</span></Form.Label><Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Nom_Projet} required type="text" name="Nom_Projet" value={formData.Nom_Projet} onChange={handleChange} size="sm"/><Form.Control.Feedback type="invalid">{formErrors.Nom_Projet}</Form.Control.Feedback></Form.Group>
                        </Row>
                        <Row className="mb-1 g-3">
                             <Form.Group as={Col} md={6} controlId="formDomaine"><Form.Label className="small mb-1 fw-medium">Domaine <span className="text-danger">*</span></Form.Label><Select name="domaine" options={domaineOptions} value={formData.domaine} required onChange={handleDomaineChange} styles={selectStyles} placeholder="- Sélectionner -" isClearable isDisabled={loadingOptions.domaines} className={formErrors.Id_Domaine ? 'is-invalid' : ''} classNamePrefix="react-select"/>{formErrors.Id_Domaine && <div className="invalid-feedback d-block ps-1 small">{formErrors.Id_Domaine}</div>}</Form.Group>
                             <Form.Group as={Col} md={6} controlId="formProgramme"><Form.Label className="small mb-1 fw-medium">Programme <span className="text-danger">*</span></Form.Label><Select name="programme" options={programmeOptions} value={formData.programme} required onChange={handleProgrammeChange} styles={selectStyles} placeholder="- Sélectionner -" isClearable isDisabled={loadingOptions.programmes} className={formErrors.Id_Programme ? 'is-invalid' : ''} classNamePrefix="react-select"/>{formErrors.Id_Programme && <div className="invalid-feedback d-block ps-1 small">{formErrors.Id_Programme}</div>}</Form.Group>
                        </Row>
                        <Row className="mb-1 g-3">
                              <Form.Group as={Col} md={6} controlId="formChantier"><Form.Label className="small mb-1 fw-medium">Chantier <span className="text-danger">*</span></Form.Label><Select name="chantier" options={chantierOptions} value={formData.chantier} required onChange={handleChantierChange} styles={selectStyles} placeholder="- Sélectionner -" isClearable isDisabled={loadingOptions.chantiers} className={formErrors.Id_Chantier ? 'is-invalid' : ''} classNamePrefix="react-select"/>{formErrors.Id_Chantier && <div className="invalid-feedback d-block ps-1 small">{formErrors.Id_Chantier}</div>}</Form.Group>
                              <Form.Group as={Col} md={6} controlId="formConvention"><Form.Label className="small mb-1 fw-medium">Convention </Form.Label><Select name="convention" options={conventionOptions} value={formData.convention} onChange={handleConventionChange} styles={selectStyles} placeholder="- Sélectionner -" isClearable isDisabled={loadingOptions.conventions} className={formErrors.Convention_Code ? 'is-invalid' : ''} classNamePrefix="react-select"/>{formErrors.Convention_Code && <div className="invalid-feedback d-block ps-1 small">{formErrors.Convention_Code}</div>}</Form.Group>
                         </Row>
                         <Row className="mb-1 g-3">
                             <Form.Group as={Col} md={6} controlId="formDateDebut"><Form.Label className="small mb-1 fw-medium">Date Début</Form.Label><Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Date_Debut} type="date" name="Date_Debut" value={formData.Date_Debut} onChange={handleChange} size="sm"/><Form.Control.Feedback type="invalid">{formErrors.Date_Debut}</Form.Control.Feedback></Form.Group>
                             <Form.Group as={Col} md={6} controlId="formDateFin"><Form.Label className="small mb-1 fw-medium">Date Fin</Form.Label><Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Date_Fin} type="date" name="Date_Fin" value={formData.Date_Fin} onChange={handleChange} size="sm" min={formData.Date_Debut || undefined}/><Form.Control.Feedback type="invalid">{formErrors.Date_Fin}</Form.Control.Feedback></Form.Group>
                         </Row>
                         <Row className="mb-1 g-3">
                              <Form.Group as={Col} md={4} controlId="formEtatAvanPhysi"><Form.Label className="small mb-1 fw-medium">Av. Physi (%)</Form.Label><Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Etat_Avan_Physi} type="number" name="Etat_Avan_Physi" value={formData.Etat_Avan_Physi} onChange={handleChange} size="sm" step="0.01" min="0" max="100"/><Form.Control.Feedback type="invalid">{formErrors.Etat_Avan_Physi}</Form.Control.Feedback></Form.Group>
                              <Form.Group as={Col} md={4} controlId="formCoutProjet"><Form.Label className="small mb-1 fw-medium">Coût Projet (MAD)</Form.Label><Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Cout_Projet} type="number" name="Cout_Projet" value={formData.Cout_Projet} onChange={handleChange} size="sm" step="0.01" min="0"/><Form.Control.Feedback type="invalid">{formErrors.Cout_Projet}</Form.Control.Feedback></Form.Group>
                              <Form.Group as={Col} md={4} controlId="formCoutCRO"><Form.Label className="small mb-1 fw-medium">Coût Part CRO (MAD)</Form.Label><Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Cout_CRO} type="number" name="Cout_CRO" value={formData.Cout_CRO} onChange={handleChange} size="sm" step="0.01" min="0"/><Form.Control.Feedback type="invalid">{formErrors.Cout_CRO}</Form.Control.Feedback></Form.Group>
                         </Row>
                         <Row className="mb-3 g-3">
                              <Form.Group as={Col} md={12} controlId="formObservations"><Form.Label className="small mb-1 fw-medium">Observations</Form.Label><Form.Control className={FORM_TEXTAREA_CLASS} style={{borderRadius: '1rem'}} as="textarea" rows={3} name="Observations" value={formData.Observations} onChange={handleChange} size="sm"/><Form.Control.Feedback type="invalid">{formErrors.Observations}</Form.Control.Feedback></Form.Group>
                         </Row>

                         {/* === Engagements Financiers Section === */}
                        <h5 className="mb-3 mt-4 fw-semibold text-warning border-bottom pb-2">Engagements Financiers des Partenaires</h5>
                        {engagementsList.length > 0 && (
                            <Card className="mb-4 border-light shadow-sm">
                                <Card.Header className="bg-light py-2"><h6 className='mb-0 fw-semibold text-secondary'>Engagements Ajoutés</h6></Card.Header>
                                <ListGroup variant="flush">
                                    {engagementsList.map((eng) => (
                                        <ListGroup.Item key={eng.tempId} className="px-3 py-2">
                                            <Row className="align-items-center g-2">
                                                <Col md={3} className="text-truncate"><strong title={eng.partenaire?.label}>{eng.partenaire?.label || 'Partenaire?'}</strong></Col>
                                                <Col md={2} xs={6}><Badge bg="info" pill className="px-2 py-1">{parseCurrency(eng.montant_engage).toLocaleString('fr-FR', {minimumFractionDigits: 2})} MAD</Badge></Col>
                                                <Col md={2} xs={6}><Badge bg="secondary" pill className="px-2 py-1">{eng.date_engagement}</Badge></Col>
                                                <Col md={2} xs={6}><FormCheck type="switch" readOnly checked={eng.est_formalise} label="Formalisé" id={`formalise-read-${eng.tempId}`} bsPrefix="form-check form-switch form-check-inline form-check-sm mb-0"/></Col>
                                                <Col md={2} className="d-none d-md-block text-truncate" title={eng.commentaire}><small className="text-muted">{eng.commentaire || '-'}</small></Col>
                                                <Col md={1} xs={12} className="text-end"><Button variant="outline-danger" size="sm" onClick={() => handleRemoveEngagement(eng.tempId)} title="Retirer"><FontAwesomeIcon icon={faTrashAlt} /></Button></Col>
                                            </Row>
                                            <Row className="d-md-none mt-1"><Col xs={12}> <small className="text-muted">{eng.commentaire || '-'}</small> </Col></Row>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                                {formErrors.engagements && <Alert variant="danger" size="sm" className="mt-2 mx-3 mb-2 py-1 small">{formErrors.engagements}</Alert>}
                            </Card>
                         )}
                         {engagementsList.length === 0 && ( <Alert variant='secondary' className='text-center py-2 small'>Aucun engagement ajouté.</Alert> )}
                         <Card className="border-light shadow-sm">
                             <Card.Header className="bg-white py-2"><Row className="align-items-center"><Col><h6 className='mb-0 fw-semibold text-secondary'><FontAwesomeIcon icon={faUserPlus} className="me-2"/>Ajouter Engagement</h6></Col><Col xs="auto"><Button variant="success" onClick={handleAddEngagement} size="sm" className="px-3" title="Ajouter à la liste"><FontAwesomeIcon icon={ faPlusCircle} className="me-1" /> Ajouter</Button></Col></Row></Card.Header>
                             <Card.Body className="p-3">
                                <Row className="g-3 align-items-start">
                                    <Col md={6} lg={3}><Form.Group controlId="formEngagementPartenaire"><Form.Label className="small mb-1 fw-medium">Partenaire </Form.Label><Select name="partenaire" options={partenaireOptions} value={currentEngagement.partenaire} onChange={handleEngagementPartnerChange} styles={selectStyles} placeholder="- Sélectionner -" isClearable isDisabled={loadingOptions.partenaires} isMulti={false} className={engagementErrors.partenaire ? 'is-invalid' : ''} classNamePrefix="react-select"/><Form.Control.Feedback type="invalid" style={{ display: engagementErrors.partenaire ? 'block' : 'none'}}>{engagementErrors.partenaire}</Form.Control.Feedback></Form.Group></Col>
                                    <Col md={6} lg={2}><Form.Group controlId="formEngagementMontant"><Form.Label className="small mb-1 fw-medium">Montant (MAD)</Form.Label><Form.Control type="number" step="0.01" min="0" name="montant_engage" size="sm" value={currentEngagement.montant_engage} onChange={handleEngagementChange} className={FORM_CONTROL_CLASS.replace('mb-3', '')} isInvalid={!!engagementErrors.montant_engage}/><Form.Control.Feedback type="invalid">{engagementErrors.montant_engage}</Form.Control.Feedback></Form.Group></Col>
                                    <Col md={4} lg={2}><Form.Group controlId="formEngagementDate"><Form.Label className="small mb-1 fw-medium">Date </Form.Label><Form.Control type="date" name="date_engagement" size="sm" value={currentEngagement.date_engagement} onChange={handleEngagementChange} className={FORM_CONTROL_CLASS.replace('mb-3', '')} isInvalid={!!engagementErrors.date_engagement}/><Form.Control.Feedback type="invalid">{engagementErrors.date_engagement}</Form.Control.Feedback></Form.Group></Col>
                                    <Col md={4} lg={3}><Form.Group controlId="formEngagementCommentaire"><Form.Label className="small mb-1 fw-medium">Commentaire</Form.Label><Form.Control type="text" name="commentaire" size="sm" value={currentEngagement.commentaire} onChange={handleEngagementChange} className={FORM_CONTROL_CLASS.replace('mb-3', '')} isInvalid={!!engagementErrors.commentaire}/><Form.Control.Feedback type="invalid">{engagementErrors.commentaire}</Form.Control.Feedback></Form.Group></Col>
                                    <Col md={4} lg={2} className="d-flex align-items-center pt-md-4"><Form.Group controlId="formEngagementFormalise" className="mt-2 mt-md-0"><FormCheck type="switch" name="est_formalise" id="engagement-formalise-switch" checked={currentEngagement.est_formalise} onChange={handleEngagementChange} label="Formalisé"/></Form.Group></Col>
                                </Row>
                            </Card.Body>
                        </Card>

                        {/* Action Buttons */}
                        <Row className={FORM_ACTIONS_ROW_CLASS}>
                            <Col xs="auto" className="pe-2"><Button onClick={onClose} variant="secondary" className={FORM_CANCEL_BUTTON_CLASS} disabled={submissionStatus.loading}>Annuler</Button></Col>
                            <Col xs="auto" className="ps-2"><Button type="submit" className={FORM_SUBMIT_BUTTON_CLASS} disabled={isSubmitDisabled}>{submissionStatus.loading ? <><Spinner as="span" animation="border" size="sm" className="me-2"/> Enreg...</> : (isEditing ? 'Enregistrer' : 'Valider')}</Button></Col>
                        </Row>
                    </Form>
                </div>
            </div>

            {/* Confirmation Modal */}
            <Modal show={showConfirmModal} onHide={handleModalCancel} centered backdrop="static" keyboard={false}>
                <Modal.Header closeButton><Modal.Title><FontAwesomeIcon icon={faExclamationTriangle} className="text-warning me-2" /> Confirmation Requise</Modal.Title></Modal.Header>
                <Modal.Body>
                    <p>{confirmModalData.message}</p>
                    {confirmModalData.details && confirmModalData.details.length > 0 && ( <div className='mb-3'><p className="mb-1 small text-muted">Affectera :</p><ListGroup variant="flush" style={{ maxHeight: '150px', overflowY: 'auto' }}>{confirmModalData.details.map((detail, index) => ( <ListGroup.Item key={index} className="px-2 py-1 small">{detail}</ListGroup.Item> ))}</ListGroup></div> )}
                    <p className="fw-bold text-danger">Action irréversible.</p><p>Voulez-vous vraiment continuer ?</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleModalCancel} disabled={submissionStatus.loading}>Annuler</Button>
                    <Button variant="danger" onClick={handleModalConfirm} disabled={submissionStatus.loading}> {submissionStatus.loading ? <Spinner as="span" size="sm" animation="border" className="me-2" /> : null} Confirmer et Supprimer </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

// --- PropTypes ---
ProjetForm.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onClose: PropTypes.func.isRequired,
    onItemCreated: PropTypes.func,
    onItemUpdated: PropTypes.func,
    baseApiUrl: PropTypes.string,
};
// --- Default Props ---
ProjetForm.defaultProps = {
    itemId: null,
    onItemCreated: (createdItem) => { console.log("Projet Created:", createdItem); },
    onItemUpdated: (updatedItem) => { console.log("Projet Updated:", updatedItem); },
    baseApiUrl: 'http://localhost:8000',
};

export default ProjetForm;