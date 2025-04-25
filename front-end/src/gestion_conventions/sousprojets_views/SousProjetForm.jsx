// src/pages/sousprojets_views/SousProjetForm.jsx

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import Select from 'react-select';
import { Form, Button, Row, Col, Alert, Spinner } from 'react-bootstrap';

// Styles for react-select
const selectStyles = {
    control: (provided, state) => ({ ...provided, backgroundColor: '#f8f9fa', borderRadius: '1.5rem', border: state.isFocused ? '1px solid #86b7fe' : '1px solid #ced4da', boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : 'none', minHeight: '38px', }), valueContainer: (provided) => ({ ...provided, padding: '0.25rem 0.8rem', }), input: (provided) => ({ ...provided, margin: '0px', padding: '0px', }), indicatorSeparator: () => ({ display: 'none', }), indicatorsContainer: (provided) => ({ ...provided, padding: '1px', }), placeholder: (provided) => ({ ...provided, color: '#6c757d', }), menu: (provided) => ({ ...provided, borderRadius: '0.5rem', boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)', zIndex: 1050 }), option: (provided, state) => ({ ...provided, backgroundColor: state.isSelected ? '#0d6efd' : state.isFocused ? '#e9ecef' : null, color: state.isSelected ? 'white' : 'black', }),
};

// CSS Classes
const FORM_CONTAINER_CLASS = "p-3 p-md-4 sousprojet-form-container";
const FORM_CONTROL_CLASS = "p-2 mt-1 mb-3 rounded-pill shadow-sm bg-light";
const FORM_TEXTAREA_CLASS = "p-2 mt-1 mb-3 rounded-5 shadow-sm bg-light "; // Standard rounded for textarea
const FORM_ACTIONS_ROW_CLASS = "mt-4 pt-2 justify-content-center flex-shrink-0";
// Adjusted button styles for consistency with Chantier example
const FORM_CANCEL_BUTTON_CLASS = "btn px-5 rounded-5 py-1 bg-danger border-0 text-white";
const FORM_SUBMIT_BUTTON_CLASS = "btn rounded-5 px-5 py-1 align-items-center d-flex justify-content-evenly bg-primary border-0";
const FORM_HEADER_CLOSE_BUTTON_CLASS = 'btn rounded-5 px-5 py-2 bg-warning shadow-sm fw-bold'; // Match ChantierVis


// --- Component Definition ---
const SousProjetForm = ({
    itemId = null, // Code_Sous_Projet when editing
    onClose,
    onItemCreated,
    onItemUpdated,
    baseApiUrl = 'http://localhost:8000/api' // Default URL *without* /api
}) => {
    // --- State Definitions ---
    const [formData, setFormData] = useState({
        // Match Model Fillable + Select Helpers
        Code_Sous_Projet: '', Nom_Projet: '', Observations: '', Etat_Avan_Physi: '',
        Etat_Avan_Finan: '', Estim_Initi: '', Secteur: '', Localite: '', Centre: '',
        Site: '', Surface: '', Lineaire: '', Status: '', Douars_Desservis: '',
        Financement: '', Nature_Intervention: '', Benificiaire: '',
        // Select helper states (camelCase for JS ease)
        projetMaitre: null, province: null, commune: null,
    });
    const isEditing = itemId !== null;
    const [projetOptions, setProjetOptions] = useState([]);
    const [provinceOptions, setProvinceOptions] = useState([]);
    const [communeOptions, setCommuneOptions] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState({ projets: true, provinces: true, communes: true });
    const [submissionStatus, setSubmissionStatus] = useState({ loading: false, error: null, success: false });
    const [formErrors, setFormErrors] = useState({});
    const [loadingData, setLoadingData] = useState(isEditing);

    // **** ADDED: Define API prefix ****
    // Change to '' if your Laravel routes are NOT prefixed with /api
    const apiPrefix = '';

    // --- Fetch Callbacks for Select Options ---
    const fetchProjets = useCallback(async () => {
        setLoadingOptions(prev => ({ ...prev, projets: true }));
        try {
            // **** FIXED: Added apiPrefix ****
            const response = await axios.get(`${baseApiUrl}${apiPrefix}/projets`, { params: { per_page: 1000 }, withCredentials: true });
            const rawData = response.data.projets || response.data.data || response.data || [];
            if (!Array.isArray(rawData)) throw new Error("Format réponse API incorrect (projets).");
            // Use Projet's primary key 'Code_Projet' as value
            const mappedOptions = rawData.map(p => ({ value: p.Code_Projet, label: `${p.Code_Projet} - ${p.Nom_Projet}` }));
            setProjetOptions(mappedOptions);
            setFormErrors(prev => ({ ...prev, projets: undefined }));
        } catch (err) { console.error("Err loading projets:", err); setFormErrors(prev => ({ ...prev, projets: "Err chrgmt projets." })); setProjetOptions([]); }
        finally { setLoadingOptions(prev => ({ ...prev, projets: false })); }
    }, [baseApiUrl, apiPrefix]); // Added apiPrefix dependency

    const fetchProvinces = useCallback(async () => {
        setLoadingOptions(prev => ({ ...prev, provinces: true }));
        setProvinceOptions([]);
        try {
            // **** FIXED: Added apiPrefix ****
            const response = await axios.get(`${baseApiUrl}${apiPrefix}/provinces`, { withCredentials: true });
            const rawData = response.data.provinces || response.data.data || response.data || [];
            if (!Array.isArray(rawData)) throw new Error("Format réponse API incorrect (provinces).");
            // Province PK is 'Id'
            const mappedOptions = rawData.map(p => ({ value: p.Id, label: p.Description })).filter(Boolean);
            setProvinceOptions(mappedOptions);
            setFormErrors(prev => ({ ...prev, provinces: undefined }));
        } catch (err) { console.error("Err loading provinces:", err); setFormErrors(prev => ({ ...prev, provinces: "Err chrgmt provinces." })); }
        finally { setLoadingOptions(prev => ({ ...prev, provinces: false })); }
    }, [baseApiUrl, apiPrefix]); // Added apiPrefix dependency

    const fetchCommunes = useCallback(async () => {
        setLoadingOptions(prev => ({ ...prev, communes: true }));
        setCommuneOptions([]);
        try {
            // **** FIXED: Added apiPrefix ****
            const response = await axios.get(`${baseApiUrl}${apiPrefix}/communes`, { withCredentials: true });
            const rawData = response.data.communes || response.data.data || response.data || [];
            if (!Array.isArray(rawData)) throw new Error("Format réponse API incorrect (communes).");
            // Commune PK is 'Id' (based on model/controller). If it's 'Code', change value to c.Code
            const mappedOptions = rawData.map(c => ({ value: c.Id, label: c.Description })).filter(Boolean);
            setCommuneOptions(mappedOptions);
            setFormErrors(prev => ({ ...prev, communes: undefined }));
        } catch (err) { console.error("Err loading communes:", err); setFormErrors(prev => ({ ...prev, communes: "Err chrgmt communes." })); }
        finally { setLoadingOptions(prev => ({ ...prev, communes: false })); }
    }, [baseApiUrl, apiPrefix]); // Added apiPrefix dependency

    // --- useEffect to run fetches on mount ---
    useEffect(() => {
        fetchProjets();
        fetchProvinces();
        fetchCommunes();
    }, [fetchProjets, fetchProvinces, fetchCommunes]); // Correct dependencies


    // --- useEffect to Fetch Existing Data When Editing ---
    useEffect(() => {
        const optionsFinishedLoading = !loadingOptions.projets && !loadingOptions.provinces && !loadingOptions.communes;

        if (!isEditing) {
            // Reset form if switching from edit to create and form has data
             if (formData.Code_Sous_Projet) {
                 console.log("[SousProjetForm] Resetting form for Create mode");
                 setFormData({ Code_Sous_Projet: '', Nom_Projet: '', Observations: '', Etat_Avan_Physi: '', Etat_Avan_Finan: '', Estim_Initi: '', Secteur: '', Localite: '', Centre: '', Site: '', Surface: '', Lineaire: '', Status: '', Douars_Desservis: '', Financement: '', Nature_Intervention: '', Benificiaire: '', projetMaitre: null, province: null, commune: null, });
                 setFormErrors({}); setLoadingData(false); setSubmissionStatus({ loading: false, error: null, success: false });
             }
             return; // Exit if not editing
        }

        // If editing, only proceed if options are loaded
        if (!optionsFinishedLoading) {
            console.log("[SousProjetForm Edit] Waiting for options to load...");
            setLoadingData(true); // Keep showing loader
            return;
        }

        // Proceed with fetching edit data
        let isMounted = true;
        const fetchSousProjetData = async () => {
            setLoadingData(true);
            setSubmissionStatus({ loading: false, error: null, success: false }); // Reset status
            setFormErrors({});
            console.log(`[SousProjetForm Edit] Fetching data for ID: ${itemId}`);
            try {
                // Get CSRF cookie first (NO apiPrefix for sanctum/csrf-cookie)
               

                // **** FIXED: Added apiPrefix ****
                const response = await axios.get(`${baseApiUrl}/sousprojets/${itemId}`, { withCredentials: true });
                const data = response.data.sousprojet || response.data.sous_projet || response.data;
                console.log("[SousProjetForm Edit] Fetched Data:", data);

                if (!data) throw new Error("Sous-Projet non trouvé pour modification.");

                if (isMounted) {
                    const findOption = (options, valueToFind) => {
                        if (valueToFind === null || valueToFind === undefined) return null;
                        return options?.find(opt => String(opt.value) === String(valueToFind)) || null;
                    };

                    // Update formData state
                    setFormData({
                        // Use ?? '' for potentially null values to ensure controlled components
                        Code_Sous_Projet: String(data.Code_Sous_Projet ?? ''),
                        Nom_Projet: data.Nom_Projet ?? '', // Assuming Nom_Projet cannot be null based on validation
                        Observations: data.Observations ?? '',
                        Etat_Avan_Physi: data.Etat_Avan_Physi ?? '',
                        Etat_Avan_Finan: data.Etat_Avan_Finan ?? '',
                        Estim_Initi: data.Estim_Initi ?? '',
                        Secteur: data.Secteur ?? '', // Assuming Secteur cannot be null
                        Localite: data.Localite ?? '',
                        Centre: data.Centre ?? '',
                        Site: data.Site ?? '',
                        Surface: data.Surface ?? '',
                        Lineaire: data.Lineaire ?? '',
                        Status: data.Status ?? '', // Assuming Status cannot be null
                        Douars_Desservis: data.Douars_Desservis ?? '',
                        Financement: data.Financement ?? '',
                        Nature_Intervention: data.Nature_Intervention ?? '',
                        Benificiaire: data.Benificiaire ?? '',
                        // Use the loaded options arrays to find the correct select objects
                        projetMaitre: findOption(projetOptions, data.ID_Projet_Maitre),
                        province: findOption(provinceOptions, data.Id_Province),
                        commune: findOption(communeOptions, data.Id_Commune),
                    });
                }
            } catch (err) {
                console.error("[SousProjetForm Edit] Error loading data:", err.response || err);
                const errorMsg = err.response?.data?.message || err.response?.data?.failed || err.message || "Erreur chargement données.";
                if (isMounted) setSubmissionStatus({ loading: false, error: errorMsg + (err.response ? ` (Status: ${err.response.status})` : ''), success: false });
            } finally {
                if (isMounted) setLoadingData(false);
            }
        };

        fetchSousProjetData();
        return () => { isMounted = false };
        // Dependencies updated to include apiPrefix and ensure re-fetch logic based on options loading
    }, [itemId, isEditing, baseApiUrl, apiPrefix, loadingOptions.projets, loadingOptions.provinces, loadingOptions.communes, projetOptions, provinceOptions, communeOptions]);


    // --- Validation ---
    const validateForm = () => {
        const errors = {};
        // Required text fields
        if (!formData.Code_Sous_Projet?.trim()) errors.Code_Sous_Projet = "Code Sous-Projet requis.";
        if (!formData.Nom_Projet?.trim()) errors.Nom_Projet = "Nom Sous-Projet requis.";
        // if (!formData.Secteur?.trim()) errors.Secteur = "Secteur requis.";
        // if (!formData.Status?.trim()) errors.Status = "Statut requis.";

        // Required Selects
        if (!formData.projetMaitre) errors.ID_Projet_Maitre = "Projet Maître requis.";
        if (!formData.province) errors.Id_Province = "Province requise.";
        // if (!formData.commune) errors.Id_Commune = "Commune requise.";

        // Required numeric fields
        const checkRequiredNumeric = (field, name) => {
            const value = formData[field];
            if ((field === 'Etat_Avan_Physi' || field === 'Etat_Avan_Finan') && (parseFloat(value) < 0 || parseFloat(value) > 100)) {
                 errors[field] = `${name} doit être entre 0 et 100.`;
             } 
        };
        checkRequiredNumeric('Etat_Avan_Physi', 'Av. Physique (%)');
        checkRequiredNumeric('Etat_Avan_Finan', 'Av. Financier (%)');
        checkRequiredNumeric('Estim_Initi', 'Estimation Initiale');

        // Optional numeric fields
        const checkOptionalNumeric = (field, name) => {
            const value = formData[field];
            if (value !== '' && value !== null && value !== undefined) {
                if (isNaN(parseFloat(value))) {
                    errors[field] = `${name} doit être un nombre.`;
                } else if (parseFloat(value) < 0) {
                     errors[field] = `${name} ne peut pas être négatif.`;
                 }
            }
        };
        checkOptionalNumeric('Surface', 'Surface');
        checkOptionalNumeric('Lineaire', 'Linéaire');

        setFormErrors(errors);
        console.log("[SousProjetForm] Validation Errors:", errors);
        return Object.keys(errors).length === 0; // True if no errors
    };

    // --- Handlers ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (formErrors[name]) { setFormErrors(prev => ({ ...prev, [name]: undefined })); }
    };
    const handleProjetMaitreChange = (selectedOption) => { setFormData(prev => ({ ...prev, projetMaitre: selectedOption })); if (formErrors.ID_Projet_Maitre) setFormErrors(prev => ({ ...prev, ID_Projet_Maitre: undefined })); };
    const handleProvinceChange = (selectedOption) => { setFormData(prev => ({ ...prev, province: selectedOption })); if (formErrors.Id_Province) setFormErrors(prev => ({ ...prev, Id_Province: undefined })); };
    const handleCommuneChange = (selectedOption) => { setFormData(prev => ({ ...prev, commune: selectedOption })); if (formErrors.Id_Commune) setFormErrors(prev => ({ ...prev, Id_Commune: undefined })); };


    // --- Submit Handler ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmissionStatus({ loading: true, error: null, success: false });
        setFormErrors({});

        if (!validateForm()) {
            setSubmissionStatus({ loading: false, error: "Veuillez corriger les erreurs dans le formulaire.", success: false });
            console.log("[SousProjetForm] Frontend validation failed.");
            return;
        }

        // --- Prepare FormData ---
        const dataToSubmit = new FormData();
        // Append required fields first
        dataToSubmit.append('Code_Sous_Projet', formData.Code_Sous_Projet);
        dataToSubmit.append('Nom_Projet', formData.Nom_Projet);
        dataToSubmit.append('Etat_Avan_Physi', formData.Etat_Avan_Physi);
        dataToSubmit.append('Etat_Avan_Finan', formData.Etat_Avan_Finan);
        dataToSubmit.append('Estim_Initi', formData.Estim_Initi);
        dataToSubmit.append('Secteur', formData.Secteur);
        dataToSubmit.append('Status', formData.Status);
        if (formData.projetMaitre?.value) dataToSubmit.append('ID_Projet_Maitre', formData.projetMaitre.value);
        if (formData.province?.value) dataToSubmit.append('Id_Province', formData.province.value);
        if (formData.commune?.value) dataToSubmit.append('Id_Commune', formData.commune.value);

        // Append optional fields (use ?? '' to ensure empty strings are sent, not 'null'/'undefined')
        dataToSubmit.append('Observations', formData.Observations ?? '');
        dataToSubmit.append('Localite', formData.Localite ?? '');
        dataToSubmit.append('Centre', formData.Centre ?? '');
        dataToSubmit.append('Site', formData.Site ?? '');
        dataToSubmit.append('Surface', formData.Surface ?? '');
        dataToSubmit.append('Lineaire', formData.Lineaire ?? '');
        dataToSubmit.append('Douars_Desservis', formData.Douars_Desservis ?? '');
        dataToSubmit.append('Financement', formData.Financement ?? '');
        dataToSubmit.append('Nature_Intervention', formData.Nature_Intervention ?? '');
        dataToSubmit.append('Benificiaire', formData.Benificiaire ?? '');

        // --- Determine URL and Method ---
        // **** FIXED: Added apiPrefix ****
        const url = isEditing
            ? `${baseApiUrl}/sousprojets/${itemId}`
            : `${baseApiUrl}${apiPrefix}/sousprojets`;

        const httpMethodConfig = {
            headers: { 'Accept': 'application/json' },
            withCredentials: true,
        };

        if (isEditing) {
            dataToSubmit.append('_method', 'PUT');
            console.log(`[SousProjetForm] Submitting PUT (via POST) to ${url}`);
        } else {
            console.log(`[SousProjetForm] Submitting POST to ${url}`);
        }

        // console.log("Submitting FormData (Final):");
        // for (let pair of dataToSubmit.entries()) { console.log(pair[0]+ ': ', pair[1]); }

        // --- API Call ---
        try {
            // Ensure CSRF cookie is fresh (NO apiPrefix)

            // Make the API request
            const response = await axios.post(url, dataToSubmit, httpMethodConfig);

            console.log(`[SousProjetForm] API ${isEditing ? 'Update' : 'Create'} Response:`, response.data);
            setSubmissionStatus({ loading: false, error: null, success: true });

            // Call the correct callback on success
            const submittedData = Object.fromEntries(dataToSubmit.entries()); // Convert FormData to object for callbacks
            delete submittedData._method; // Remove method spoofing field

            if (isEditing && onItemUpdated) {
                console.log("[SousProjetForm] Calling onItemUpdated callback");
                onItemUpdated(response.data.sousprojet || submittedData);
            } else if (!isEditing && onItemCreated) {
                console.log("[SousProjetForm] Calling onItemCreated callback");
                onItemCreated(response.data.sousprojet || submittedData);
            }
            // setTimeout(onClose, 1500); // Optional delay before closing

        } catch (err) {
            console.error(`[SousProjetForm] Erreur lors de ${isEditing ? 'la modification' : 'la création'}:`, err.response || err);
            let errorMsg = `Une erreur s'est produite.`;
            const backendErrors = {};

            if (err.response) {
                 if (err.response.status === 422 && typeof err.response.data.errors === 'object') {
                     const validationErrors = err.response.data.errors;
                     let messages = [];
                     for (const key in validationErrors) {
                         backendErrors[key] = validationErrors[key]?.[0] || "Erreur inconnue.";
                         messages.push(backendErrors[key]);
                     }
                     setFormErrors(backendErrors); // Show specific field errors
                     errorMsg = messages.length > 0 ? messages.join(' ') : "Erreurs de validation.";
                 } else if (err.response.status === 419) {
                     errorMsg = "Session expirée ou formulaire invalide (CSRF). Veuillez rafraîchir et réessayer.";
                 } else if (err.response.data?.failed) { // Check for specific backend 'failed' key
                     errorMsg = err.response.data.failed;
                 } else if (err.response.data?.message) {
                     errorMsg = err.response.data.message;
                 } else if (err.message?.includes('Network Error')) {
                     errorMsg = "Erreur réseau. Impossible de joindre le serveur.";
                 } else if (err.response?.statusText) {
                    errorMsg = `Erreur serveur (${err.response.status}): ${err.response.statusText}`;
                 } else {
                     errorMsg = `Erreur serveur (${err.response.status})`;
                 }
            } else if (err.request) {
                errorMsg = "Aucune réponse reçue du serveur. Vérifiez la connexion et l'URL.";
            } else {
                errorMsg = `Erreur de configuration de la requête: ${err.message}`;
            }
            setSubmissionStatus({ loading: false, error: errorMsg, success: false });
        }
    };

    // --- Render Logic ---
    // Disable submit only when actively submitting or essential data/options are loading
    const isLoadingAnything = loadingData || loadingOptions.projets || loadingOptions.provinces || loadingOptions.communes;
    const isSubmitDisabled = submissionStatus.loading || isLoadingAnything;

    // Show specific loading state for editing
    if (isEditing && loadingData) {
        return (
            <div className="d-flex justify-content-center align-items-center p-5" style={{ minHeight: '300px' }}>
               <Spinner animation="border" variant="primary" />
               <span className='ms-3 text-muted'>Chargement des données du sous-projet...</span>
            </div>
        );
    }

    return (
        <div className={FORM_CONTAINER_CLASS} style={{ backgroundColor: '#fff', borderRadius: '20px', boxShadow: '0 6px 18px rgba(0,0,0,0.1)', maxHeight: 'calc(90vh - 100px)', overflowY: 'auto' }}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4 flex-shrink-0 border-bottom pb-3">
                <div>
                    <h5 className="text-uppercase fw-bold text-secondary mb-1">{isEditing ? 'Modifier le' : 'Créer un nouveau'}</h5>
                    <h2 className="mb-0 fw-bold">Sous-Projet {isEditing ? `(${itemId})` : ''}</h2>
                </div>
                <Button variant="warning" className={FORM_HEADER_CLOSE_BUTTON_CLASS} onClick={onClose} size="sm">
                    Revenir à la liste
                </Button>
            </div>

            {/* Form Content */}
            <div className="flex-grow-1 px-md-3">
                {/* Feedback Area */}
                {submissionStatus.error && (<Alert variant="danger" className="mb-3 py-2" dismissible onClose={() => setSubmissionStatus(prev => ({ ...prev, error: null }))}><FontAwesomeIcon icon={faExclamationTriangle} className="me-2" /> {submissionStatus.error}</Alert>)}
                {submissionStatus.success && (<Alert variant="success" className="mb-3 py-2">Sous-Projet {isEditing ? 'modifié' : 'créé'} avec succès!</Alert>)}

                <Form noValidate onSubmit={handleSubmit}>
                    {/* Row 1: Code Sous-Projet, Nom Sous-Projet */}
                    <Row className="mb-3 g-3">
                        <Form.Group as={Col} md={6} controlId="formCodeSousProjet">
                            <Form.Label className="small mb-1 fw-medium">Code Sous-Projet <span className="text-danger">*</span></Form.Label>
                            <Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Code_Sous_Projet} required type="text" name="Code_Sous_Projet" value={formData.Code_Sous_Projet} onChange={handleChange} size="sm" disabled={isEditing} title={isEditing ? "Le code ne peut pas être modifié après création" : ""} />
                            <Form.Control.Feedback type="invalid">{formErrors.Code_Sous_Projet}</Form.Control.Feedback>
                        </Form.Group>
                        <Form.Group as={Col} md={6} controlId="formNomProjet">
                            <Form.Label className="small mb-1 fw-medium">Nom Sous-Projet <span className="text-danger">*</span></Form.Label>
                            <Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Nom_Projet} required type="text" name="Nom_Projet" value={formData.Nom_Projet} onChange={handleChange} size="sm" />
                            <Form.Control.Feedback type="invalid">{formErrors.Nom_Projet}</Form.Control.Feedback>
                        </Form.Group>
                    </Row>

                    {/* Row 2: Projet Maître, Province */}
                    <Row className="mb-3 g-3">
                        <Form.Group as={Col} md={6} controlId="formProjetMaitre">
                            <Form.Label className="small mb-1 fw-medium">Projet Maître <span className="text-danger">*</span></Form.Label>
                            <Select name="projetMaitre" options={projetOptions} value={formData.projetMaitre} onChange={handleProjetMaitreChange} styles={selectStyles} placeholder={loadingOptions.projets ? "Chargement..." : "- Sélectionner Projet -"} isClearable isLoading={loadingOptions.projets} isDisabled={loadingOptions.projets} className={formErrors.ID_Projet_Maitre ? 'is-invalid' : ''} aria-label="Sélectionner Projet Maître" menuPlacement="auto" />
                            {formErrors.projets && !loadingOptions.projets && <div className="text-danger small mt-1">{formErrors.projets}</div>}
                            {formErrors.ID_Projet_Maitre && <div className="invalid-feedback d-block">{formErrors.ID_Projet_Maitre}</div>}
                        </Form.Group>
                        <Form.Group as={Col} md={6} controlId="formProvince">
                            <Form.Label className="small mb-1 fw-medium">Province <span className="text-danger">*</span></Form.Label>
                            <Select name="province" options={provinceOptions} value={formData.province} onChange={handleProvinceChange} styles={selectStyles} placeholder={loadingOptions.provinces ? "Chargement..." : "- Sélectionner Province -"} isClearable isLoading={loadingOptions.provinces} isDisabled={loadingOptions.provinces} className={formErrors.Id_Province ? 'is-invalid' : ''} aria-label="Sélectionner Province" menuPlacement="auto" />
                            {formErrors.provinces && !loadingOptions.provinces && <div className="text-danger small mt-1">{formErrors.provinces}</div>}
                            {formErrors.Id_Province && <div className="invalid-feedback d-block">{formErrors.Id_Province}</div>}
                        </Form.Group>
                    </Row>

                    {/* Row 3: Commune, Statut */}
                    <Row className="mb-3 g-3">
                        <Form.Group as={Col} md={6} controlId="formCommune">
                            <Form.Label className="small mb-1 fw-medium">Commune </Form.Label>
                            <Select name="commune" options={communeOptions} value={formData.commune} onChange={handleCommuneChange} styles={selectStyles} placeholder={loadingOptions.communes ? "Chargement..." : "- Sélectionner Commune -"} isClearable isLoading={loadingOptions.communes} isDisabled={loadingOptions.communes} className={formErrors.Id_Commune ? 'is-invalid' : ''} aria-label="Sélectionner Commune" menuPlacement="auto" />
                            {formErrors.communes && !loadingOptions.communes && <div className="text-danger small mt-1">{formErrors.communes}</div>}
                            {formErrors.Id_Commune && <div className="invalid-feedback d-block">{formErrors.Id_Commune}</div>}
                        </Form.Group>
                        <Form.Group as={Col} md={6} controlId="formStatus">
                            <Form.Label className="small mb-1 fw-medium">Statut</Form.Label>
                            <Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Status} type="text" name="Status" value={formData.Status} onChange={handleChange} size="sm" placeholder="Ex: En cours, Terminé, Planifié" />
                            <Form.Control.Feedback type="invalid">{formErrors.Status}</Form.Control.Feedback>
                        </Form.Group>
                    </Row>

                     {/* Row 4: Secteur, Localite, Centre, Site */}
                     <Row className="mb-3 g-3">
                         <Form.Group as={Col} md={3} controlId="formSecteur">
                            <Form.Label className="small mb-1 fw-medium">Secteur </Form.Label>
                            <Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Secteur} type="text" name="Secteur" value={formData.Secteur} onChange={handleChange} size="sm"/>
                            <Form.Control.Feedback type="invalid">{formErrors.Secteur}</Form.Control.Feedback>
                         </Form.Group>
                         <Form.Group as={Col} md={3} controlId="formLocalite">
                            <Form.Label className="small mb-1 fw-medium">Localité</Form.Label>
                            <Form.Control className={FORM_CONTROL_CLASS} type="text" name="Localite" value={formData.Localite} onChange={handleChange} size="sm"/>
                         </Form.Group>
                         <Form.Group as={Col} md={3} controlId="formCentre">
                            <Form.Label className="small mb-1 fw-medium">Centre</Form.Label>
                            <Form.Control className={FORM_CONTROL_CLASS} type="text" name="Centre" value={formData.Centre} onChange={handleChange} size="sm"/>
                         </Form.Group>
                          <Form.Group as={Col} md={3} controlId="formSite">
                            <Form.Label className="small mb-1 fw-medium">Site</Form.Label>
                            <Form.Control className={FORM_CONTROL_CLASS} type="text" name="Site" value={formData.Site} onChange={handleChange} size="sm"/>
                          </Form.Group>
                     </Row>

                    {/* Row 5: Avancements, Estimation */}
                     <Row className="mb-3 g-3">
                          <Form.Group as={Col} md={4} controlId="formEtatAvanPhysi">
                            <Form.Label className="small mb-1 fw-medium">Av. Physique (%) </Form.Label>
                            <Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Etat_Avan_Physi}  type="number" name="Etat_Avan_Physi" value={formData.Etat_Avan_Physi} onChange={handleChange} size="sm" step="0.01" min="0" max="100" placeholder="0-100"/>
                            <Form.Control.Feedback type="invalid">{formErrors.Etat_Avan_Physi}</Form.Control.Feedback>
                          </Form.Group>
                          <Form.Group as={Col} md={4} controlId="formEtatAvanFinan">
                            <Form.Label className="small mb-1 fw-medium">Av. Financier (%) </Form.Label>
                            <Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Etat_Avan_Finan}  type="number" name="Etat_Avan_Finan" value={formData.Etat_Avan_Finan} onChange={handleChange} size="sm" step="0.01" min="0" max="100" placeholder="0-100"/>
                            <Form.Control.Feedback type="invalid">{formErrors.Etat_Avan_Finan}</Form.Control.Feedback>
                          </Form.Group>
                          <Form.Group as={Col} md={4} controlId="formEstimIniti">
                            <Form.Label className="small mb-1 fw-medium">Estim. Initiale </Form.Label>
                            <Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Estim_Initi}  type="number" name="Estim_Initi" value={formData.Estim_Initi} onChange={handleChange} size="sm" step="0.01" min="0" placeholder="Montant"/>
                            <Form.Control.Feedback type="invalid">{formErrors.Estim_Initi}</Form.Control.Feedback>
                           </Form.Group>
                     </Row>

                     {/* Row 6: Surface, Linéaire, Financement */}
                     <Row className="mb-3 g-3">
                           <Form.Group as={Col} md={4} controlId="formSurface">
                             <Form.Label className="small mb-1 fw-medium">Surface</Form.Label>
                             <Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Surface} type="number" name="Surface" value={formData.Surface} onChange={handleChange} size="sm" step="any" min="0" placeholder="Nombre"/>
                             <Form.Control.Feedback type="invalid">{formErrors.Surface}</Form.Control.Feedback>
                           </Form.Group>
                           <Form.Group as={Col} md={4} controlId="formLineaire">
                             <Form.Label className="small mb-1 fw-medium">Linéaire</Form.Label>
                             <Form.Control className={FORM_CONTROL_CLASS} isInvalid={!!formErrors.Lineaire} type="number" name="Lineaire" value={formData.Lineaire} onChange={handleChange} size="sm" step="any" min="0" placeholder="Nombre"/>
                             <Form.Control.Feedback type="invalid">{formErrors.Lineaire}</Form.Control.Feedback>
                           </Form.Group>
                            <Form.Group as={Col} md={4} controlId="formFinancement">
                              <Form.Label className="small mb-1 fw-medium">Financement</Form.Label>
                              <Form.Control className={FORM_CONTROL_CLASS} type="text" name="Financement" value={formData.Financement} onChange={handleChange} size="sm" placeholder="Source(s) de financement"/>
                           </Form.Group>
                      </Row>

                     {/* Row 7: Nature Intervention, Bénéficiaire, Douars Desservis */}
                     <Row className="mb-3 g-3">
                            <Form.Group as={Col} md={4} controlId="formNatureIntervention">
                              <Form.Label className="small mb-1 fw-medium">Nature Intervention</Form.Label>
                              <Form.Control className={FORM_CONTROL_CLASS} type="text" name="Nature_Intervention" value={formData.Nature_Intervention} onChange={handleChange} size="sm"/>
                            </Form.Group>
                            <Form.Group as={Col} md={4} controlId="formBenificiaire">
                              <Form.Label className="small mb-1 fw-medium">Bénéficiaire</Form.Label>
                              <Form.Control className={FORM_CONTROL_CLASS} type="text" name="Benificiaire" value={formData.Benificiaire} onChange={handleChange} size="sm"/>
                            </Form.Group>
                            <Form.Group as={Col} md={4} controlId="formDouarsDesservis">
                              <Form.Label className="small mb-1 fw-medium">Douars Desservis</Form.Label>
                              <Form.Control className={FORM_CONTROL_CLASS} type="text" name="Douars_Desservis" value={formData.Douars_Desservis} onChange={handleChange} size="sm"/>
                            </Form.Group>
                      </Row>

                    {/* Row 8: Observations */}
                    <Row className="mb-3 g-3">
                        <Form.Group as={Col} md={12} controlId="formObservations">
                            <Form.Label className="small mb-1 fw-medium">Observations</Form.Label>
                            <Form.Control className={FORM_TEXTAREA_CLASS} style={{ borderRadius: '1rem' }} as="textarea" rows={3} name="Observations" value={formData.Observations} onChange={handleChange} size="sm" />
                            <Form.Control.Feedback type="invalid">{formErrors.Observations}</Form.Control.Feedback>
                        </Form.Group>
                    </Row>

                    {/* Action Buttons */}
                    <Row className={FORM_ACTIONS_ROW_CLASS}>
                         <Col xs="auto" className="pe-2">
                             <Button onClick={onClose} variant="danger" className={FORM_CANCEL_BUTTON_CLASS} disabled={submissionStatus.loading}>
                                 Annuler
                             </Button>
                         </Col>
                         <Col xs="auto" className="ps-2">
                             <Button type="submit" className={FORM_SUBMIT_BUTTON_CLASS} disabled={isSubmitDisabled}>
                                 {submissionStatus.loading ? <><Spinner as="span" animation="border" size="sm" className="me-2"/> {isEditing ? 'Enregistrement...' : 'Création...'}</> : (isEditing ? 'Enregistrer Modifications' : 'Créer Sous-Projet')}
                             </Button>
                         </Col>
                    </Row>
                </Form>
            </div>
        </div>
    );
};

// --- PropTypes ---
SousProjetForm.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onClose: PropTypes.func.isRequired,
    onItemCreated: PropTypes.func,
    onItemUpdated: PropTypes.func,
    baseApiUrl: PropTypes.string,
};

// --- Default Props ---
SousProjetForm.defaultProps = {
    itemId: null,
    onItemCreated: () => {},
    onItemUpdated: () => {},
    baseApiUrl: 'http://localhost:8000', // Default without /api
};

export default SousProjetForm;