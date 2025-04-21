// src/gestion_contrats_cdc_views/ContratDroitCommunForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Form, Button, Row, Col, Spinner, Alert, Card, Stack, Badge } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrashAlt, faPaperclip, faTimes } from '@fortawesome/free-solid-svg-icons';

// --- Constants ---
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://192.168.30.241:81/api';
// Define type options if you have a fixed list
const TYPE_CONTRAT_OPTIONS = [
    { value: 'Maintenance', label: 'Maintenance' },
    { value: 'Prestation de service', label: 'Prestation de service' },
    { value: 'Location', label: 'Location' },
    { value: 'Fourniture', label: 'Fourniture' },
    { value: 'Autre', label: 'Autre' },
];

// --- Form Component ---
const ContratDroitCommunForm = ({ itemId, onClose, onItemCreated, onItemUpdated, baseApiUrl = BASE_API_URL }) => {
    const isEditMode = !!itemId;

    // --- Initial State ---
    const initialFormData = {
        numero_contrat: '',
        objet: '',
        fournisseur_nom: '',
        date_signature: '',
        montant_total: '',
        duree_contrat: '',
        type_contrat: '', // Store simple string value or object if using React Select
        mode_paiement: '',
        observations: '',
        // File states
        fichiers: [],             // Holds NEW File objects selected by user
        existing_fichiers: [],    // Holds info {id, nom_fichier, chemin_fichier} of existing files
        fichiers_to_delete: []    // Holds IDs of existing files marked for deletion
    };

    const [formData, setFormData] = useState(initialFormData);
    const [isLoading, setIsLoading] = useState(isEditMode); // Loading form data state
    const [isSubmitting, setIsSubmitting] = useState(false); // Submission loading state
    const [error, setError] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});

    const apiEndpoint = isEditMode
        ? `${baseApiUrl}/contrat-droit-commun/${itemId}`
        : `${baseApiUrl}/contrat-droit-commun`;

    // --- Effect to Fetch Data (Edit Mode) ---
    useEffect(() => {
        let isMounted = true;
        if (isEditMode) {
            setIsLoading(true);
            setError(null);
            setValidationErrors({});
            console.log(`[CDC Form] Fetching edit data for Contrat ID: ${itemId}`);

            axios.get(apiEndpoint, { params: { include: 'fichiers' } }) // Request files too
                .then(response => {
                    if (!isMounted) return;
                    const itemData = response.data?.contrat_droit_commun || response.data || {};
                    console.log("[CDC Form] Fetched item data:", itemData);

                    // Format date for input type="date"
                    const formattedDate = itemData.date_signature ? itemData.date_signature.split(' ')[0] : '';

                    // Map existing files
                    const existingFiles = (itemData.fichiers || []).map(f => ({
                        id: f.id,
                        nom_fichier: f.nom_fichier,
                        // You might need chemin_fichier if you want to add view links in the form
                        chemin_fichier: f.chemin_fichier
                    }));

                    setFormData(prev => ({
                        ...prev,
                        numero_contrat: itemData.numero_contrat || '',
                        objet: itemData.objet || '',
                        fournisseur_nom: itemData.fournisseur_nom || '',
                        date_signature: formattedDate,
                        montant_total: itemData.montant_total || '',
                        duree_contrat: itemData.duree_contrat || '',
                        type_contrat: itemData.type_contrat || '', // Adjust if using Select with objects
                        mode_paiement: itemData.mode_paiement || '',
                        observations: itemData.observations || '',
                        fichiers: [], // Reset new files on load
                        existing_fichiers: existingFiles,
                        fichiers_to_delete: [], // Reset files to delete on load
                    }));
                })
                .catch(err => {
                    if (!isMounted) return;
                    console.error("[CDC Form] Error fetching data:", err);
                    setError(err.response?.data?.message || err.message || "Erreur de chargement des données du contrat.");
                    setFormData(initialFormData); // Reset form on error
                })
                .finally(() => {
                    if (isMounted) setIsLoading(false);
                });
        } else {
            // Reset form for create mode
            setFormData(initialFormData);
            setIsLoading(false);
        }
        return () => { isMounted = false; }; // Cleanup
    }, [itemId, isEditMode, apiEndpoint]);

    // --- Input Handlers ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (validationErrors[name]) {
            setValidationErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    // --- File Handlers ---
    const handleFileChange = useCallback((e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        // Append new files, prevent duplicates by name if needed
        setFormData(prev => ({
            ...prev,
            fichiers: [...(prev.fichiers || []), ...files]
        }));
        e.target.value = null; // Reset file input
        if (validationErrors['fichiers'] || validationErrors['fichiers.*']) {
            setValidationErrors(prev => ({ ...prev, 'fichiers': null, 'fichiers.*': null }));
        }
    }, []);

    const removeNewFile = useCallback((fileIndex) => {
        setFormData(prev => ({
            ...prev,
            fichiers: (prev.fichiers || []).filter((_, fIdx) => fIdx !== fileIndex)
        }));
    }, []);

    const removeExistingFile = useCallback((fileId) => {
        if (!window.confirm("Supprimer ce fichier existant ? Il sera effacé lors de la sauvegarde.")) return;
        setFormData(prev => ({
            ...prev,
            existing_fichiers: (prev.existing_fichiers || []).filter(f => f.id !== fileId),
            fichiers_to_delete: [...(prev.fichiers_to_delete || []), fileId]
        }));
    }, []);

    // --- Server Error Mapping ---
    const mapServerErrors = useCallback((serverErrors) => {
        const formErrors = {};
        if (!serverErrors || typeof serverErrors !== 'object') return formErrors;
        for (const key in serverErrors) {
            // Handle nested errors like 'fichiers.0' -> 'fichiers.*'
            if (key.startsWith('fichiers.')) {
                formErrors['fichiers.*'] = serverErrors[key]; // Use wildcard key
            } else {
                formErrors[key] = serverErrors[key]; // Direct mapping for other fields
            }
        }
        console.warn("Mapped validation errors:", formErrors);
        return formErrors;
     }, []);


    // --- Form Submission ---
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setValidationErrors({});
        console.log("[CDC Form] Submitting data:", formData);

        const submissionPayload = new FormData();

        // Append standard fields
        Object.entries(formData).forEach(([key, value]) => {
            if (key !== 'fichiers' && key !== 'existing_fichiers' && key !== 'fichiers_to_delete') {
                submissionPayload.append(key, value ?? ''); // Send empty string for null/undefined
            }
        });

        // Append NEW files
        (formData.fichiers || []).forEach((file, index) => {
             if (file instanceof File) {
                 submissionPayload.append(`fichiers[${index}]`, file, file.name);
             }
        });

        // Append Files to Delete IDs
        if (formData.fichiers_to_delete && formData.fichiers_to_delete.length > 0) {
            // Send as an array directly recognized by Laravel
            formData.fichiers_to_delete.forEach((id, index) => {
                 submissionPayload.append(`fichiers_to_delete[${index}]`, id);
            });
            // Alternatively, stringify if backend expects JSON:
            // submissionPayload.append('fichiers_to_delete', JSON.stringify(formData.fichiers_to_delete));
        }

        // Add PUT method for updates when using POST
        if (isEditMode) {
            submissionPayload.append('_method', 'PUT');
        }

        console.log("[CDC Form] Sending Payload...");
        // Log FormData content (for debugging - might not show files easily)
        // for (let [key, value] of submissionPayload.entries()) {
        //     console.log(`${key}:`, value);
        // }

        try {
            const config = { headers: { 'Content-Type': 'multipart/form-data', 'Accept': 'application/json' } };
            const response = await axios.post(apiEndpoint, submissionPayload, config); // Always POST for FormData

            console.log(`[CDC Form] API Response (${isEditMode ? 'Update' : 'Create'}):`, response.data);
            setError(null);
            setValidationErrors({});
            if (isEditMode && onItemUpdated) onItemUpdated(response.data.contrat_droit_commun || response.data);
            else if (!isEditMode && onItemCreated) onItemCreated(response.data.contrat_droit_commun || response.data);
            onClose(); // Close the form modal/view

        } catch (err) {
            console.error("[CDC Form] Error submitting form:", err.response || err);
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
            setIsSubmitting(false);
        }
    }, [formData, isEditMode, apiEndpoint, onItemUpdated, onItemCreated, onClose, mapServerErrors]);


    // --- Render ---
    if (isLoading) {
        return <div className="text-center p-5"><Spinner animation="border" /> Chargement...</div>;
    }

    return (
        <Form onSubmit={handleSubmit} noValidate className='p-4 holder' style={{
            maxHeight: 'calc(90vh - 100px)', // Or adjust as needed for modal context
            overflowY: 'auto', // Enable vertical scrolling HERE
        }}>
            {/* Error Alerts */}
            {error && !Object.keys(validationErrors).length && <Alert variant="danger" className="mt-3">{error}</Alert>}
            {Object.keys(validationErrors).length > 0 && <Alert variant="warning" className="mt-3 small py-2">Veuillez corriger les erreurs indiquées ci-dessous.</Alert>}

            {/* Form Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                 <div>
                     <h5 className="text-uppercase fw-bold text-secondary mb-1">{isEditMode ? 'Modifier le' : 'Créer un nouveau'}</h5>
                     <h2 className="mb-0 fw-bold">Contrat Droit Commun {isEditMode ? `(${formData.numero_contrat || '...'})` : ''}</h2>
                 </div>
                 <Button variant="warning" onClick={onClose} size="sm" title="Annuler et fermer" className='btn rounded-5 px-5 py-2 bg-warning shadow-sm'>
                     <b>Revenir a la liste</b>
                 </Button>
            </div>

            {/* Form Fields */}
            <h5 className="mb-3 mt-2">Détails du Contrat</h5>
            <Row>
                <Form.Group as={Col} md="6" className="mb-3">
                    <Form.Label htmlFor="numero_contrat">Numéro Contrat <span className="text-danger">*</span></Form.Label>
                    <Form.Control id="numero_contrat" type="text" name="numero_contrat" value={formData.numero_contrat} onChange={handleChange} isInvalid={!!validationErrors.numero_contrat} className='form-control-style shadow-sm form-control-rounded' />
                    <Form.Control.Feedback type="invalid">{validationErrors.numero_contrat?.[0]}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group as={Col} md="6" className="mb-3">
                    <Form.Label htmlFor="fournisseur_nom">Fournisseur <span className="text-danger">*</span></Form.Label>
                    <Form.Control id="fournisseur_nom" type="text" name="fournisseur_nom" value={formData.fournisseur_nom} onChange={handleChange} isInvalid={!!validationErrors.fournisseur_nom} className='form-control-style shadow-sm form-control-rounded' />
                    <Form.Control.Feedback type="invalid">{validationErrors.fournisseur_nom?.[0]}</Form.Control.Feedback>
                </Form.Group>
            </Row>

            <Form.Group className="mb-3">
                <Form.Label htmlFor="objet">Objet <span className="text-danger">*</span></Form.Label>
                <Form.Control id="objet" as="textarea" rows={2} name="objet" value={formData.objet} onChange={handleChange} isInvalid={!!validationErrors.objet} className='form-control-style shadow-sm form-control-rounded'/>
                <Form.Control.Feedback type="invalid">{validationErrors.objet?.[0]}</Form.Control.Feedback>
            </Form.Group>

            <Row>
                 <Form.Group as={Col} md="4" className="mb-3">
                    <Form.Label htmlFor="date_signature">Date Signature <span className="text-danger">*</span></Form.Label>
                    <Form.Control id="date_signature" type="date" name="date_signature" value={formData.date_signature} onChange={handleChange} isInvalid={!!validationErrors.date_signature} className='form-control-style shadow-sm form-control-rounded' />
                    <Form.Control.Feedback type="invalid">{validationErrors.date_signature?.[0]}</Form.Control.Feedback>
                 </Form.Group>
                 <Form.Group as={Col} md="4" className="mb-3">
                    <Form.Label htmlFor="montant_total">Montant Total TTC (MAD) <span className="text-danger">*</span></Form.Label>
                    <Form.Control id="montant_total" type="number" step="0.01" name="montant_total" value={formData.montant_total} onChange={handleChange} isInvalid={!!validationErrors.montant_total} placeholder="0.00" className='form-control-style shadow-sm form-control-rounded'/>
                    <Form.Control.Feedback type="invalid">{validationErrors.montant_total?.[0]}</Form.Control.Feedback>
                 </Form.Group>
                 <Form.Group as={Col} md="4" className="mb-3">
                     <Form.Label htmlFor="duree_contrat">Durée Contrat</Form.Label>
                     <Form.Control id="duree_contrat" type="text" name="duree_contrat" value={formData.duree_contrat} onChange={handleChange} isInvalid={!!validationErrors.duree_contrat} placeholder="Ex: 12 mois, 1 an..." className='form-control-style shadow-sm form-control-rounded'/>
                     <Form.Control.Feedback type="invalid">{validationErrors.duree_contrat?.[0]}</Form.Control.Feedback>
                 </Form.Group>
            </Row>

            <Row>
                 <Form.Group as={Col} md="6" className="mb-3">
                    <Form.Label htmlFor="type_contrat">Type Contrat</Form.Label>
              

<Form.Select 
    id="type_contrat"
    name="type_contrat"
    value={formData.type_contrat}
    onChange={handleChange}
    isInvalid={!!validationErrors.type_contrat}
    className='form-control-style shadow-sm form-control-rounded' 
    >
    <option value="">-- Sélectionner --</option>
    {TYPE_CONTRAT_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
</Form.Select>
                   
                    <Form.Control.Feedback type="invalid">{validationErrors.type_contrat?.[0]}</Form.Control.Feedback>
                 </Form.Group>
                 <Form.Group as={Col} md="6" className="mb-3">
                     <Form.Label htmlFor="mode_paiement">Mode Paiement</Form.Label>
                     <Form.Control id="mode_paiement" type="text" name="mode_paiement" value={formData.mode_paiement} onChange={handleChange} isInvalid={!!validationErrors.mode_paiement} placeholder="Virement, Chèque..." className='form-control-style shadow-sm form-control-rounded'/>
                     <Form.Control.Feedback type="invalid">{validationErrors.mode_paiement?.[0]}</Form.Control.Feedback>
                 </Form.Group>
            </Row>

             <Form.Group className="mb-3">
                <Form.Label htmlFor="observations">Observations</Form.Label>
                <Form.Control id="observations" as="textarea" rows={2} name="observations" value={formData.observations} onChange={handleChange} isInvalid={!!validationErrors.observations} className='form-control-style shadow-sm form-control-rounded'/>
                <Form.Control.Feedback type="invalid">{validationErrors.observations?.[0]}</Form.Control.Feedback>
            </Form.Group>

            {/* --- Files Section --- */}
            <h5 className="mt-4 mb-3">Fichiers Joints</h5>
            <Card className="mb-3 border shadow-sm">
                <Card.Body className='p-3'>
                    <Form.Group controlId="cdcFileGroup">
                         <Form.Label className="small mb-1 text-muted">
                             <FontAwesomeIcon icon={faPaperclip} className="me-1"/> Joindre Fichiers
                         </Form.Label>
                         {/* Hidden actual input */}
                         <Form.Control
                             id="cdc_fichiers_hidden_input"
                             type="file"
                             multiple
                             onChange={handleFileChange}
                             style={{ display: 'none' }}
                             aria-hidden="true"
                             isInvalid={!!validationErrors['fichiers.*'] || !!validationErrors['fichiers']}
                         />
                         {/* Button to trigger input */}
                         <Button
                             variant="outline-info"
                             size="sm"
                             className="d-inline-block ms-2 rounded-5"
                             onClick={() => document.getElementById('cdc_fichiers_hidden_input')?.click()}
                         >
                             <FontAwesomeIcon icon={faPlus} className="me-1" /> Ajouter Fichier(s)
                         </Button>
                         {/* Validation errors for files */}
                         {(validationErrors['fichiers.*'] || validationErrors['fichiers']) && (
                             <div className="d-block invalid-feedback small mt-1 ms-1">
                                 {validationErrors['fichiers.*']?.[0] || validationErrors['fichiers']?.[0]}
                             </div>
                         )}

                         {/* Display EXISTING files */}
                         {isEditMode && formData.existing_fichiers?.length > 0 && (
                            <Stack direction="horizontal" gap={1} className="mt-2 flex-wrap" style={{fontSize: '0.8em'}}>
                                <span className="me-2 small text-muted">Existants:</span>
                                {formData.existing_fichiers.map((file) => (
                                    <Badge key={`existing-cdc-file-${file.id}`} pill text="dark" bg='transparent' className="d-flex border p-2 align-items-center fw-normal">
                                        <span className='me-1 text-truncate' style={{maxWidth: '120px'}} title={file.nom_fichier}>{file.nom_fichier}</span>
                                        <Button  size="sm" aria-label="Supprimer existant" className="p-0 ms-1 px-2 btn text-danger bg-transparent border-danger" style={{fontSize:'10px'}} onClick={() => removeExistingFile(file.id)} title="Marquer pour suppression"><FontAwesomeIcon icon={faTrashAlt} /></Button>
                                    </Badge>
                                ))}
                            </Stack>
                         )}

                         {/* Display NEW files */}
                         {formData.fichiers?.length > 0 && (
                             <Stack direction="horizontal" gap={1} className={`${(isEditMode && formData.existing_fichiers?.length > 0) ? 'mt-1' : 'mt-2'} flex-wrap`} style={{fontSize: '0.8em'}}>
                                <span className="me-2 small text-muted">Nouveaux:</span>
                                {formData.fichiers.map((file, fileIndex) => (
                                    <Badge key={`new-cdc-file-${file.name}-${fileIndex}`} pill bg="success" className="d-flex align-items-center fw-normal">
                                        <span className='me-1 p-2 text-truncate' style={{maxWidth: '120px'}} title={file.name}>{file.name}</span>
                                        <Button variant="close" size="sm" aria-label="Retirer nouveau" className="btn-close-white p-0 ms-1" style={{fontSize: '1em', filter: 'invert(1) grayscale(100%) brightness(200%)'}} onClick={() => removeNewFile(fileIndex)}></Button>
                                    </Badge>
                                ))}
                             </Stack>
                         )}

                         {/* Placeholder if no files */}
                         {!formData.fichiers?.length && !formData.existing_fichiers?.length && (
                             <div className="mt-2 small text-muted fst-italic">Aucun fichier joint.</div>
                         )}
                    </Form.Group>
                </Card.Body>
            </Card>
             {/* --- END Files Section --- */}


            {/* Submit/Cancel Buttons */}
            <div className="text-center mt-4 pt-3 border-top">
                 <Button variant="danger" onClick={onClose} className="me-2 rounded-5 px-5">Annuler</Button>
                 <Button variant="primary" type="submit" className="me-2 rounded-5 px-5" disabled={isSubmitting}>
                    {isSubmitting ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/> : null}
                    {isSubmitting ? 'Enregistrement...' : (isEditMode ? 'Enregistrer Modifications' : 'Créer Contrat')}
                </Button>
            </div>
        </Form>
    );
};

// --- PropTypes ---
ContratDroitCommunForm.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onClose: PropTypes.func.isRequired,
    onItemCreated: PropTypes.func,
    onItemUpdated: PropTypes.func,
    baseApiUrl: PropTypes.string,
};

export default ContratDroitCommunForm;