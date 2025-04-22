// src/gestion_conventions/appel_offres_views/AppelOffreForm.jsx

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Form, Button, Row, Col, Spinner, Alert, InputGroup } from 'react-bootstrap';
import Select from 'react-select'; // Multi-select capable

// --- Constants ---
const CATEGORIE_OPTIONS = [
    { value: 'Travaux', label: 'Travaux' },
    { value: 'Etudes', label: 'Etudes' },
    { value: 'Services', label: 'Services' },
    { value: 'Fournitures', label: 'Fournitures' }
];

const PROVINCE_OPTIONS = [
    { value: 'Berkane', label: 'Berkane' },
    { value: 'Driouch', label: 'Driouch' },
    { value: 'Figuig', label: 'Figuig' },
    { value: 'Guercif', label: 'Guercif' },
    { value: 'Jerada', label: 'Jerada' },
    { value: 'Nador', label: 'Nador' },
    { value: 'Oujda-Angad', label: 'Oujda-Angad' },
    { value: 'Taourirt', label: 'Taourirt' }
];

const initialFormData = {
    categorie: null,
    provinces: null,
    numero: '',
    intitule: '',
    estimation: '',
    estimation_HT: '',
    montant_TVA: '',
    duree_execution: '',
    date_verification: '',
    date_ouverture: '',
    last_session_op: '',
    date_publication: '', // <-- ADDED initial state for new field
    lancement_portail: false,
    date_lancement_portail: '',
};
// --- End Constants ---

const AppelOffreForm = ({ itemId, onClose, onItemCreated, onItemUpdated, baseApiUrl }) => {
    const isEditMode = !!itemId;

    // --- State ---
    const [formData, setFormData] = useState(initialFormData);
    const [selectedProvinceOptions, setSelectedProvinceOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(isEditMode);
    const [error, setError] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});

    const apiEndpoint = isEditMode
        ? `${baseApiUrl}/appel-offres/${itemId}`
        : `${baseApiUrl}/appel-offres`;

    // --- Effect to Fetch Appel d'Offre Data (for Edit Mode) ---
    useEffect(() => {
        let isMounted = true;
        if (isEditMode) {
            setIsLoading(true);
            setError(null);
            setValidationErrors({});
            console.log(`Form: Fetching edit data for Appel d'Offre ID: ${itemId}`);

            axios.get(apiEndpoint)
                .then(response => {
                    if (!isMounted) return;
                    const itemData = response.data?.appel_offre || response.data || {};
                    console.log("Fetched Appel d'Offre item data:", itemData);

                    // Populate formData, using 'provinces' array field & new date_publication
                    setFormData({
                        categorie: itemData.categorie || '',
                        provinces: Array.isArray(itemData.provinces) ? itemData.provinces : null,
                        numero: itemData.numero || '',
                        intitule: itemData.intitule || '',
                        estimation: itemData.estimation ?? '',
                        estimation_HT: itemData.estimation_HT ?? '',
                        montant_TVA: itemData.montant_TVA ?? '',
                        duree_execution: itemData.duree_execution ?? '',
                        date_verification: itemData.date_verification ? itemData.date_verification.split(' ')[0] : '',
                        date_ouverture: itemData.date_ouverture ? itemData.date_ouverture.split(' ')[0] : '',
                        last_session_op: itemData.last_session_op ? itemData.last_session_op.split(' ')[0] : '',
                        // Extract date part for date_publication input (type="date")
                        // Assuming backend sends datetime like "YYYY-MM-DD HH:MM:SS"
                        date_publication: itemData.date_publication ? itemData.date_publication.split(' ')[0] : '', // <-- ADDED handling
                        lancement_portail: !!itemData.lancement_portail,
                        date_lancement_portail: itemData.date_lancement_portail ? itemData.date_lancement_portail.split(' ')[0] : '',
                    });

                    // Pre-select the province options
                    if (Array.isArray(itemData.provinces)) {
                        const matchedOptions = itemData.provinces
                            .map(provinceName => PROVINCE_OPTIONS.find(opt => opt.value === provinceName))
                            .filter(opt => opt !== undefined);
                        setSelectedProvinceOptions(matchedOptions);
                    } else {
                        setSelectedProvinceOptions([]);
                    }
                })
                .catch(err => {
                    if (!isMounted) return;
                    console.error("Error fetching Appel d'Offre data for edit:", err);
                    setError(err.response?.data?.message || err.message || "Erreur de chargement des données.");
                    setFormData(initialFormData);
                    setSelectedProvinceOptions([]);
                 })
                .finally(() => {
                   if (isMounted) setIsLoading(false);
                });
        } else {
             setFormData(initialFormData);
             setSelectedProvinceOptions([]);
             setIsLoading(false);
        }
    }, [itemId, isEditMode, apiEndpoint]);

    // --- Input Handlers ---
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        setFormData(prev => ({ ...prev, [name]: val }));
        if (validationErrors[name]) {
            setValidationErrors(prev => { const next = {...prev}; delete next[name]; return next; });
        }
    };

    const handleProvinceMultiSelectChange = (selectedOptionsArray) => {
        setSelectedProvinceOptions(selectedOptionsArray || []);
        const provinceValues = selectedOptionsArray ? selectedOptionsArray.map(option => option.value) : null;
        setFormData(prev => ({
            ...prev,
            provinces: provinceValues && provinceValues.length > 0 ? provinceValues : null
        }));
        if (validationErrors.provinces || validationErrors['provinces.*']) {
             setValidationErrors(prev => {
                 const next = {...prev};
                 delete next.provinces;
                 delete next['provinces.*'];
                 return next;
             });
        }
    };
    // --- END Input Handlers ---

    // --- Server Error Mapping ---
    const mapServerErrors = useCallback((serverErrors) => {
        const formErrors = {};
        if (!serverErrors || typeof serverErrors !== 'object') return formErrors;
        for (const key in serverErrors) {
            const messages = Array.isArray(serverErrors[key]) ? serverErrors[key] : [serverErrors[key]];
            if (key.startsWith('provinces.')) {
                formErrors['provinces.*'] = messages;
            } else {
                formErrors[key] = messages;
            }
        }
        console.log("Mapped validation errors:", formErrors);
        return formErrors;
     }, []);

    // --- Form Submission ---
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setIsLoading(true); setError(null); setValidationErrors({});

        // Prepare payload - include date_publication
        // Send date as YYYY-MM-DD string, backend cast handles conversion
        const payload = {
            ...formData,
            estimation: (formData.estimation !== '' && !isNaN(Number(formData.estimation))) ? parseFloat(formData.estimation) : null,
            estimation_HT: (formData.estimation_HT !== '' && !isNaN(Number(formData.estimation_HT))) ? parseFloat(formData.estimation_HT) : null,
            montant_TVA: (formData.montant_TVA !== '' && !isNaN(Number(formData.montant_TVA))) ? parseFloat(formData.montant_TVA) : null,
            duree_execution: (formData.duree_execution !== '' && !isNaN(Number(formData.duree_execution))) ? parseInt(formData.duree_execution, 10) : null,
            date_verification: formData.date_verification || null,
            date_ouverture: formData.date_ouverture || null,
            last_session_op: formData.last_session_op || null,
            date_publication: formData.date_publication || null, // <-- Send string or null
            date_lancement_portail: formData.lancement_portail ? (formData.date_lancement_portail || null) : null,
        };

        console.log("Submitting Payload:", payload);
        try {
            const config = { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } };
            let response;
            if (isEditMode) {
                response = await axios.put(apiEndpoint, payload, config);
            } else {
                response = await axios.post(apiEndpoint, payload, config);
            }
            // ... existing success handling ...
            console.log(`API Response (${isEditMode ? 'Update' : 'Create'}):`, response.data);
            setError(null); setValidationErrors({});
            if (isEditMode && onItemUpdated) onItemUpdated(response.data.appel_offre || response.data);
            else if (!isEditMode && onItemCreated) onItemCreated(response.data.appel_offre || response.data);
            onClose();

        } catch (err) { // ... existing error handling ...
             console.error("Error submitting form:", err.response || err);
             const message = err.response?.data?.message || err.message || "Erreur de soumission.";
             if (err.response && err.response.status === 422) {
                 const serverErrors = err.response.data.errors || {};
                 console.error("Validation Errors from Server:", serverErrors);
                 setValidationErrors(mapServerErrors(serverErrors));
                 setError("Veuillez corriger les erreurs indiquées.");
             } else {
                setError(message);
                setValidationErrors({});
             }
        } finally {
            setIsLoading(false);
        }
    }, [formData, isEditMode, apiEndpoint, onItemUpdated, onItemCreated, onClose, mapServerErrors]);

    const isOverallLoading = isLoading;

    if (isLoading && isEditMode) {
        return <div className="text-center p-5"><Spinner animation="border" /> Chargement des données...</div>;
    }

    // --- Main Form Render ---
    return (
        <Form onSubmit={handleSubmit} noValidate className='px-5 py-5' style={{ maxHeight: 'calc(90vh - 100px)', overflowY: 'auto' }}>
            {/* Error Alerts */}
            {error && !Object.keys(validationErrors).length && <Alert variant="danger" className="mt-3">{error}</Alert>}
            {Object.keys(validationErrors).length > 0 && <Alert variant="warning" className="mt-3 small py-2">Veuillez corriger les erreurs indiquées ci-dessous.</Alert>}

            {/* Header */}
             <div className="d-flex justify-content-between align-items-center mb-4 flex-shrink-0">
                 <div>
                     <h5 className="text-uppercase fw-bold text-secondary mb-1">{isEditMode ? 'Modifier' : 'Nouvel'}</h5>
                     <h2 className="mb-0 fw-bold">Appel d'Offre {isEditMode ? `(${formData.numero || '...'})` : ''}</h2>
                 </div>
                 <Button variant="light" className='btn rounded-5 px-5 py-2 bg-warning shadow-sm' onClick={onClose} size="sm" title="Retour">
                      <b>Revenir a la liste</b>
                 </Button>
             </div>

            {/* --- Form Fields --- */}
            <h5 className="mb-3 mt-2">Détails de l'Appel d'Offre</h5>
            <Row>
                {/* Numero AO */}
                <Form.Group as={Col} md="6" className="mb-3">
                    <Form.Label htmlFor="numero">Numéro AO <span className="text-danger">*</span></Form.Label>
                    <Form.Control id="numero" className='form-control-style shadow-sm form-control-rounded' type="text" name="numero" value={formData.numero} onChange={handleChange} isInvalid={!!validationErrors.numero} />
                    <Form.Control.Feedback type="invalid">{validationErrors.numero?.[0]}</Form.Control.Feedback>
                </Form.Group>
                {/* Catégorie */}
                <Form.Group as={Col} md="6" className="mb-3">
                    <Form.Label htmlFor="categorie">Catégorie <span className="text-danger">*</span></Form.Label>
                    <Form.Select id="categorie" className='form-control-style shadow-sm form-control-rounded' name="categorie" value={formData.categorie || ''} onChange={handleChange} isInvalid={!!validationErrors.categorie}>
                        <option value="" disabled>-- Sélectionner --</option>
                        {CATEGORIE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">{validationErrors.categorie?.[0]}</Form.Control.Feedback>
                </Form.Group>
            </Row>

            {/* Intitule */}
            <Form.Group className="mb-3">
               <Form.Label htmlFor="intitule">Intitulé <span className="text-danger">*</span></Form.Label>
               <Form.Control id="intitule" className='form-control-style shadow-sm form-control-rounded' as="textarea" rows={2} name="intitule" value={formData.intitule} onChange={handleChange} isInvalid={!!validationErrors.intitule} />
               <Form.Control.Feedback type="invalid">{validationErrors.intitule?.[0]}</Form.Control.Feedback>
           </Form.Group>

            {/* Province Multi-Select */}
            <Form.Group className="mb-3">
                 <Form.Label htmlFor="provinces_select">Province(s)</Form.Label>
                 <Select
                     inputId="provinces_select"
                     isMulti
                     name="provinces_select"
                     options={PROVINCE_OPTIONS}
                     value={selectedProvinceOptions}
                     onChange={handleProvinceMultiSelectChange}
                     placeholder={"Sélectionner Province(s) (Optionnel)..."}
                     isClearable
                     closeMenuOnSelect={false}
                     noOptionsMessage={() => 'Aucune province définie'}
                     styles={{
                         control: (baseStyles) => ({
                             ...baseStyles,
                             borderColor: (validationErrors.provinces || validationErrors['provinces.*']) ? '#dc3545' : baseStyles.borderColor,
                             borderRadius:'50px',
                             backgroundColor:'#f8f9fa'
                         }),
                     }}
                 />
                 {(validationErrors.provinces || validationErrors['provinces.*']) &&
                    <div className="d-block invalid-feedback">
                        {validationErrors.provinces?.[0] || validationErrors['provinces.*']?.[0]}
                    </div>
                 }
            </Form.Group>

            {/* Estimations */}
            <Row>
                <Form.Group as={Col} md="4" className="mb-3">
                    <Form.Label htmlFor="estimation">Estimation TTC (MAD)</Form.Label>
                    <InputGroup>
                        <Form.Control id="estimation" className='form-control-style shadow-sm form-control-rounded-start' type="number" step="0.01" name="estimation" value={formData.estimation} onChange={handleChange} isInvalid={!!validationErrors.estimation} placeholder="Optionnel"/>
                        <InputGroup.Text className='form-control-rounded-end'>MAD</InputGroup.Text>
                        <Form.Control.Feedback type="invalid">{validationErrors.estimation?.[0]}</Form.Control.Feedback>
                    </InputGroup>
                </Form.Group>
                 <Form.Group as={Col} md="4" className="mb-3">
                    <Form.Label htmlFor="estimation_HT">Estimation HT (MAD) <span className="text-danger">*</span></Form.Label>
                     <InputGroup>
                        <Form.Control id="estimation_HT" className='form-control-style shadow-sm form-control-rounded-start' type="number" step="0.01" name="estimation_HT" value={formData.estimation_HT} onChange={handleChange} isInvalid={!!validationErrors.estimation_HT} placeholder="0.00"/>
                        <InputGroup.Text className='form-control-rounded-end'>MAD</InputGroup.Text>
                        <Form.Control.Feedback type="invalid">{validationErrors.estimation_HT?.[0]}</Form.Control.Feedback>
                    </InputGroup>
                </Form.Group>
                <Form.Group as={Col} md="4" className="mb-3">
                    <Form.Label htmlFor="montant_TVA">Montant TVA (MAD) <span className="text-danger">*</span></Form.Label>
                     <InputGroup>
                        <Form.Control id="montant_TVA" className='form-control-style shadow-sm form-control-rounded-start' type="number" step="0.01" name="montant_TVA" value={formData.montant_TVA} onChange={handleChange} isInvalid={!!validationErrors.montant_TVA} placeholder="0.00"/>
                        <InputGroup.Text className='form-control-rounded-end'>MAD</InputGroup.Text>
                        <Form.Control.Feedback type="invalid">{validationErrors.montant_TVA?.[0]}</Form.Control.Feedback>
                    </InputGroup>
                </Form.Group>
            </Row>

            {/* Durée & Dates */}
            <Row>
                <Form.Group as={Col} md="6" lg="3" className="mb-3">
                    <Form.Label htmlFor="duree_execution">Durée Exécution (jours)</Form.Label>
                    <Form.Control id="duree_execution" className='form-control-style shadow-sm form-control-rounded' type="number" step="1" min="0" name="duree_execution" value={formData.duree_execution} onChange={handleChange} isInvalid={!!validationErrors.duree_execution} placeholder="Optionnel"/>
                    <Form.Control.Feedback type="invalid">{validationErrors.duree_execution?.[0]}</Form.Control.Feedback>
                </Form.Group>
                 <Form.Group as={Col} md="6" lg="3" className="mb-3">
                    <Form.Label htmlFor="date_verification">Date Vérification</Form.Label>
                    <Form.Control id="date_verification" className='form-control-style shadow-sm form-control-rounded' type="date" name="date_verification" value={formData.date_verification} onChange={handleChange} isInvalid={!!validationErrors.date_verification} />
                    <Form.Control.Feedback type="invalid">{validationErrors.date_verification?.[0]}</Form.Control.Feedback>
                 </Form.Group>
                 <Form.Group as={Col} md="6" lg="3" className="mb-3">
                    <Form.Label htmlFor="date_ouverture">Date Ouverture Plis</Form.Label>
                    <Form.Control id="date_ouverture" className='form-control-style shadow-sm form-control-rounded' type="date" name="date_ouverture" value={formData.date_ouverture} onChange={handleChange} isInvalid={!!validationErrors.date_ouverture} />
                    <Form.Control.Feedback type="invalid">{validationErrors.date_ouverture?.[0]}</Form.Control.Feedback>
                 </Form.Group>
                 <Form.Group as={Col} md="6" lg="3" className="mb-3">
                     <Form.Label htmlFor="last_session_op">Dernière Session Ouverture Plis</Form.Label>
                     <Form.Control id="last_session_op" className='form-control-style shadow-sm form-control-rounded' type="date" name="last_session_op" value={formData.last_session_op} onChange={handleChange} isInvalid={!!validationErrors.last_session_op} />
                     <Form.Control.Feedback type="invalid">{validationErrors.last_session_op?.[0]}</Form.Control.Feedback>
                 </Form.Group>
            </Row>

            {/* --- ADDED: Date Publication --- */}
            <Row>
                <Form.Group as={Col} md="6" className="mb-3">
                    <Form.Label htmlFor="date_publication">Date Publication</Form.Label>
                    <Form.Control
                        id="date_publication"
                        className='form-control-style shadow-sm form-control-rounded'
                        type="date" // Use type="date" as we only care about the date part here
                        name="date_publication"
                        value={formData.date_publication} // Bind to state
                        onChange={handleChange}
                        isInvalid={!!validationErrors.date_publication}
                     />
                    <Form.Control.Feedback type="invalid">{validationErrors.date_publication?.[0]}</Form.Control.Feedback>
                </Form.Group>
                {/* Placeholder column to balance layout or add another field later */}
                <Col md="6"></Col>
            </Row>
             {/* --- END ADDED --- */}


            {/* Portail */}
            <Row>
                <Form.Group as={Col} md="6" className="mb-3 d-flex align-items-center pt-3">
                    <Form.Check
                        type="switch"
                        id="lancement_portail"
                        label="Lancement Portail Achat Public"
                        name="lancement_portail"
                        checked={formData.lancement_portail}
                        onChange={handleChange}
                        isInvalid={!!validationErrors.lancement_portail}
                    />
                    <Form.Control.Feedback type="invalid" className="d-block ms-2">
                         {validationErrors.lancement_portail?.[0]}
                     </Form.Control.Feedback>
                </Form.Group>
                {/* Conditionally render Date Lancement Portail field */}
                {formData.lancement_portail && (
                    <Form.Group as={Col} md="6" className="mb-3">
                        <Form.Label htmlFor="date_lancement_portail">Date Lancement Portail</Form.Label>
                        <Form.Control
                            id="date_lancement_portail"
                            className='form-control-style shadow-sm form-control-rounded'
                            type="date"
                            name="date_lancement_portail"
                            value={formData.date_lancement_portail}
                            onChange={handleChange}
                            isInvalid={!!validationErrors.date_lancement_portail}
                         />
                        <Form.Control.Feedback type="invalid">{validationErrors.date_lancement_portail?.[0]}</Form.Control.Feedback>
                    </Form.Group>
                )}
            </Row>


            {/* Submit/Cancel Buttons */}
             <div className="text-center mt-4 pt-3 border-top">
                 <Button variant="danger" onClick={onClose} className="me-2 rounded-5 px-5">Annuler</Button>
                 <Button variant="primary" type="submit" className="me-2 rounded-5 px-5" disabled={isOverallLoading}>
                     {isOverallLoading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/> : null}
                     {isOverallLoading ? 'Chargement...' : (isEditMode ? 'Enregistrer Modifications' : 'Créer Appel d\'Offre')}
                 </Button>
             </div>
        </Form>
    );
};

// --- PropTypes ---
AppelOffreForm.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onClose: PropTypes.func.isRequired,
    onItemCreated: PropTypes.func,
    onItemUpdated: PropTypes.func,
    baseApiUrl: PropTypes.string.isRequired,
};

export default AppelOffreForm;