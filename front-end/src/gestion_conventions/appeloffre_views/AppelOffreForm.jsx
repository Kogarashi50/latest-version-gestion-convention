// src/gestion_conventions/appel_offres_views/AppelOffreForm.jsx

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios'; // Use your configured instance
import { Form, Button, Row, Col, Spinner, Alert, InputGroup } from 'react-bootstrap';
import Select from 'react-select'; // For Province selection

// --- Constants ---
const CATEGORIE_OPTIONS = [
    { value: 'Travaux', label: 'Travaux' },
    { value: 'Etudes', label: 'Etudes' },
    { value: 'Services', label: 'Services' },
    { value: 'Fournitures', label: 'Fournitures' }
];

// Initial empty state for the form
const initialFormData = {
    categorie: null, // Use null for react-select compatibility if needed, or ''
    province_id: null,
    numero: '',
    intitule: '',
    estimation: '',
    estimation_HT: '',
    montant_TVA: '',
    duree_execution: '',
    date_verification: '',
    date_ouverture: '',
    last_session_op: '',
    lancement_portail: false, // Default boolean state
    date_lancement_portail: '',
};
// --- End Constants ---

const AppelOffreForm = ({ itemId, onClose, onItemCreated, onItemUpdated, baseApiUrl }) => {
    const isEditMode = !!itemId;

    // --- State ---
    const [formData, setFormData] = useState(initialFormData);
    const [provinceOptions, setProvinceOptions] = useState([]);
    const [selectedProvinceOption, setSelectedProvinceOption] = useState(null); // UI state for province Select
    const [loadingProvinces, setLoadingProvinces] = useState(true);
    const [isLoading, setIsLoading] = useState(isEditMode); // Main form loading/submitting state
    const [error, setError] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});

    const apiEndpoint = isEditMode
        ? `${baseApiUrl}/appel-offres/${itemId}`
        : `${baseApiUrl}/appel-offres`;

    // --- Effect to fetch Province Options ---
    useEffect(() => {
        let isMounted = true;
        setLoadingProvinces(true);
        console.log("Fetching province options for select...");

        axios.get(`${baseApiUrl}/provinces`) // Adjust if your endpoint differs
            .then(response => {
                if (!isMounted) return;
                // ** ADAPT based on your actual API response structure **
                // Assuming response structure like { provinces: [{ Id: 1, Description: '...', ... }] }
                // Or adjust if it's just an array [{ Id: 1, ...}]
                const provincesList = response.data?.provinces || response.data || [];

                if (!Array.isArray(provincesList)) {
                    console.error("Province data received is not an array:", provincesList);
                    throw new Error("Format de données de province invalide reçu.");
                }

                // ** Map to { value: Id, label: Description } format - Check exact field names **
                const formattedOptions = provincesList.map(opt => {
                    if (!opt || opt.Id === undefined || opt.Description === undefined) { // Check required fields
                       console.warn("Skipping invalid province option:", opt);
                       return null; // Skip invalid entries
                   }
                   return { value: opt.Id, label: opt.Description }; // Assuming 'Id' and 'Description'
                }).filter(opt => opt !== null);

                console.log("Fetched and formatted province options:", formattedOptions);
                setProvinceOptions(formattedOptions);
            })
            .catch(error => {
                if (!isMounted) return;
                console.error("Error fetching province options:", error);
                setError(prev => prev ? `${prev}\nErreur chargement liste provinces.` : "Erreur chargement liste provinces.");
                setProvinceOptions([]); // Set empty on error
            })
            .finally(() => {
                if (isMounted) setLoadingProvinces(false);
            });

        return () => { isMounted = false; }; // Cleanup
    }, [baseApiUrl]); // Runs once on mount or if baseApiUrl changes

    // --- Effect to Fetch Appel d'Offre Data (for Edit Mode) ---
    useEffect(() => {
        let isMounted = true;
        // Only run if in edit mode AND province options have loaded
        if (isEditMode && !loadingProvinces) {
            setIsLoading(true); // Start main form loading
            setError(null);
            setValidationErrors({});
            console.log(`Form: Fetching edit data for Appel d'Offre ID: ${itemId}`);

            axios.get(apiEndpoint)
                .then(response => {
                    if (!isMounted) return;

                    // ** ADAPT based on your API response structure for a single item **
                    // Assuming structure like { appel_offre: { id: ..., numero: ..., ... } }
                    const itemData = response.data?.appel_offre || response.data || {};
                    console.log("Fetched Appel d'Offre item data:", itemData);

                    // Populate formData, handle potential nulls and date formatting
                    setFormData({
                        categorie: itemData.categorie || '', // Needs adjustment if using react-select for categorie
                        province_id: itemData.province_id || null,
                        numero: itemData.numero || '',
                        intitule: itemData.intitule || '',
                        estimation: itemData.estimation ?? '', // Use ?? for null/undefined -> ''
                        estimation_HT: itemData.estimation_HT ?? '',
                        montant_TVA: itemData.montant_TVA ?? '',
                        duree_execution: itemData.duree_execution ?? '',
                        date_verification: itemData.date_verification ? itemData.date_verification.split(' ')[0] : '', // Extract YYYY-MM-DD
                        date_ouverture: itemData.date_ouverture ? itemData.date_ouverture.split(' ')[0] : '',
                        last_session_op: itemData.last_session_op ? itemData.last_session_op.split(' ')[0] : '',
                        lancement_portail: !!itemData.lancement_portail, // Ensure boolean
                        date_lancement_portail: itemData.date_lancement_portail ? itemData.date_lancement_portail.split(' ')[0] : '',
                    });

                    // Pre-select the province option based on the fetched ID
                    const matchedOption = provinceOptions.find(opt => opt.value === itemData.province_id);
                    if (matchedOption) {
                        console.log("Pre-selecting province option by ID:", matchedOption);
                        setSelectedProvinceOption(matchedOption);
                    } else {
                        setSelectedProvinceOption(null); // Reset if not found or no province linked
                    }

                })
                .catch(err => {
                    if (!isMounted) return;
                    console.error("Error fetching Appel d'Offre data for edit:", err);
                    setError(err.response?.data?.message || err.message || "Erreur de chargement des données.");
                    setFormData(initialFormData); // Reset form on error
                    setSelectedProvinceOption(null);
                })
                .finally(() => {
                   if (isMounted) setIsLoading(false); // Stop main form loading
                });

        } else if (!isEditMode) {
             // Reset form for create mode
             setFormData(initialFormData);
             setSelectedProvinceOption(null);
             setIsLoading(false); // Not loading in create mode initially
        }
        // This effect depends on provinceOptions being loaded in edit mode
    }, [itemId, isEditMode, apiEndpoint, loadingProvinces, provinceOptions]);

    // --- Input Handlers ---
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;

        setFormData(prev => ({ ...prev, [name]: val }));

        // Clear validation error for the specific field
        if (validationErrors[name]) {
            setValidationErrors(prev => { const next = {...prev}; delete next[name]; return next; });
        }
    };

    const handleProvinceSelectChange = (selectedOption) => {
        setSelectedProvinceOption(selectedOption); // Update UI state
        // Update actual form data ID
        setFormData(prev => ({ ...prev, province_id: selectedOption ? selectedOption.value : null }));

        // Clear validation error for 'province_id'
        if (validationErrors.province_id) {
             setValidationErrors(prev => { const next = {...prev}; delete next.province_id; return next; });
        }
    };
    // --- END Input Handlers ---

    // --- Server Error Mapping ---
    const mapServerErrors = useCallback((serverErrors) => {
        const formErrors = {};
        if (!serverErrors || typeof serverErrors !== 'object') return formErrors;
        for (const key in serverErrors) {
            // Direct mapping should work fine for this flat structure
            formErrors[key] = Array.isArray(serverErrors[key]) ? serverErrors[key] : [serverErrors[key]];
        }
        console.log("Mapped validation errors:", formErrors);
        return formErrors;
     }, []);

    // --- Form Submission ---
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (loadingProvinces && !isEditMode) { // Basic check
             setError("Veuillez patienter pendant le chargement des options.");
             return;
        }
        setIsLoading(true); setError(null); setValidationErrors({});

        // Prepare payload - ensure correct types if necessary
        const payload = {
            ...formData,
            // Ensure numbers are sent as numbers or null if empty/invalid
            estimation: (formData.estimation !== '' && !isNaN(Number(formData.estimation))) ? parseFloat(formData.estimation) : null,
            estimation_HT: (formData.estimation_HT !== '' && !isNaN(Number(formData.estimation_HT))) ? parseFloat(formData.estimation_HT) : null,
            montant_TVA: (formData.montant_TVA !== '' && !isNaN(Number(formData.montant_TVA))) ? parseFloat(formData.montant_TVA) : null,
            duree_execution: (formData.duree_execution !== '' && !isNaN(Number(formData.duree_execution))) ? parseInt(formData.duree_execution, 10) : null,
            // province_id and lancement_portail are already correctly set in formData state
            // Dates are sent as 'YYYY-MM-DD' strings, backend handles casting
            date_verification: formData.date_verification || null,
            date_ouverture: formData.date_ouverture || null,
            last_session_op: formData.last_session_op || null,
            date_lancement_portail: formData.date_lancement_portail || null,
        };

        // Remove null date_lancement_portail if lancement_portail is false to avoid potential backend issues if not nullable
        if (!payload.lancement_portail) {
            payload.date_lancement_portail = null;
        }

        console.log("Submitting Payload:", payload);

        try {
            const config = { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } };
            let response;

            if (isEditMode) {
                response = await axios.put(apiEndpoint, payload, config);
            } else {
                response = await axios.post(apiEndpoint, payload, config);
            }

            console.log(`API Response (${isEditMode ? 'Update' : 'Create'}):`, response.data);
            setError(null); setValidationErrors({});
            if (isEditMode && onItemUpdated) onItemUpdated(response.data.appel_offre || response.data);
            else if (!isEditMode && onItemCreated) onItemCreated(response.data.appel_offre || response.data);
            onClose();

        } catch (err) {
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
    }, [formData, isEditMode, apiEndpoint, onItemUpdated, onItemCreated, onClose, loadingProvinces, mapServerErrors]);

    // Determine overall loading state
    const  isOverallLoading = isLoading || loadingProvinces

    // Show full screen spinner only when loading initial AO data in edit mode
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
                 <Button variant="warning" className='btn rounded-5 px-5 py-2 bg-warning shadow-sm' onClick={onClose} size="sm" title="Retour">
                      <b>Revenir a la liste</b>
                 </Button>
             </div>
             {loadingProvinces ? (
            <div className="text-center p-4">
                <Spinner animation="border" size="sm" /> Chargement des provinces...
            </div>
        ) : (<>
            {/* --- Form Fields --- */}
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

            {/* Province */}
            <Form.Group className="mb-3">
                 <Form.Label htmlFor="province_select">Province</Form.Label>
                 <Select
                     inputId="province_select"
                     name="province_select" // Internal name
                     options={provinceOptions}
                     value={selectedProvinceOption} // Controlled by UI state
                     onChange={handleProvinceSelectChange} // Specific handler
                     isLoading={loadingProvinces}
                     isDisabled={loadingProvinces}
                     placeholder={loadingProvinces ? "Chargement Provinces..." : "Sélectionner Province (Optionnel)..."}
                     isClearable
                     noOptionsMessage={() => 'Aucune province trouvée'}
                     loadingMessage={() => 'Chargement...'}
                     styles={{
                         control: (baseStyles) => ({
                             ...baseStyles,
                             borderColor: validationErrors.province_id ? '#dc3545' : baseStyles.borderColor, // Check actual data key
                             borderRadius:'50px',
                             backgroundColor:'#f8f9fa'
                         }),
                     }}
                 />
                 {validationErrors.province_id && <div className="d-block invalid-feedback">{validationErrors.province_id[0]}</div>}
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
                {formData.lancement_portail&& <Form.Group as={Col} md="6" className="mb-3">
                     <Form.Label htmlFor="date_lancement_portail">Date Lancement Portail</Form.Label>
                     <Form.Control
                         id="date_lancement_portail"
                         className={`form-control-style ${formData.lancement_portail ? '' : ' text-secondary'}  shadow-sm form-control-rounded`}
                         type="date"
                         name="date_lancement_portail"
                         value={formData.date_lancement_portail}
                         onChange={handleChange}

                         isInvalid={!!validationErrors.date_lancement_portail}
                         disabled={!formData.lancement_portail} // Disable if switch is off
                      />
                     <Form.Control.Feedback type="invalid">{validationErrors.date_lancement_portail?.[0]}</Form.Control.Feedback>
                 </Form.Group>}
            </Row>
           

            {/* Submit/Cancel Buttons */}
             <div className="text-center mt-4 pt-3 border-top">
                 <Button variant="danger" onClick={onClose} className="me-2 rounded-5 px-5">Annuler</Button>
                 <Button variant="primary" type="submit" className="me-2 rounded-5 px-5" disabled={isOverallLoading}>
                     {isEditMode ? 'Enregistrer Modifications' : 'Créer Appel d\'Offre'}
                 </Button>
             </div> </>)}
        </Form>
    );
};

// --- PropTypes ---
AppelOffreForm.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Optional: If present, we're in edit mode
    onClose: PropTypes.func.isRequired,
    onItemCreated: PropTypes.func,
    onItemUpdated: PropTypes.func,
    baseApiUrl: PropTypes.string.isRequired,
};

export default AppelOffreForm;