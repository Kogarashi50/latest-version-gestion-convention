import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import Select from 'react-select';
import {
    Modal, Button, Form, Row, Col, Spinner, Alert, InputGroup,
    Card // Assuming you still want the Card wrapper
} from 'react-bootstrap';

// --- Helpers ---
const PAIEMENT_METHODE_OPTIONS = [ { value: "Virement", label: "Virement Bancaire" }, { value: "Chèque", label: "Chèque" }, { value: "Espèces", label: "Espèces" }, { value: "Autre", label: "Autre" } ];
const formatCurrency = (amount) => { const number = parseFloat(amount); if (isNaN(number)) return null; return number.toLocaleString('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2, maximumFractionDigits: 2 });};
const truncateText = (text, maxLength = 60) => { if (!text) return ''; if (text.length <= maxLength) { return text; } return text.substring(0, maxLength) + '...';};
// --- End Helpers ---


const VersementForm = ({
    itemId, onClose, onItemCreated, onItemUpdated, baseApiUrl
}) => {
    const isEditMode = itemId != null;

    // --- State ---
    const [formData, setFormData] = useState({ date_versement: '', montant_verse: '', moyen_paiement: '', reference_paiement: '', commentaire: '' });

    // State for Create Mode Dropdowns
    const [conventionOptions, setConventionOptions] = useState([]);
    const [selectedConvention, setSelectedConvention] = useState(null);
    const [partenaireOptions, setPartenaireOptions] = useState([]);
    const [selectedPartenaireOption, setSelectedPartenaireOption] = useState(null);

    // State for Edit Mode Display & Create Mode ID resolution
    const [convPartDetails, setConvPartDetails] = useState({
        id_cp: null, // Crucial: Holds the Id_CP for submission/validation
        montant_convenu: null,
        displayConventionLabel: '', // <<< NEW: For edit mode display
        displayPartenaireLabel: ''  // <<< NEW: For edit mode display
    });

    // Loading States
    const [conventionLoading, setConventionLoading] = useState(false);
    const [partenaireLoading, setPartenaireLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // General submit/edit load state

    // Error States
    const [error, setError] = useState(null);
    const [conventionError, setConventionError] = useState(null);
    const [partenaireError, setPartenaireError] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});

    // --- Effects ---

    // Effect 1: Fetch Conventions (Only in Create Mode)
    useEffect(() => {
        if (!isEditMode) {
            // Reset everything when switching to create mode
            setFormData({ date_versement: '', montant_verse: '', moyen_paiement: '', reference_paiement: '', commentaire: '' });
            setSelectedConvention(null);
            setSelectedPartenaireOption(null);
            setPartenaireOptions([]);
            setConvPartDetails({ id_cp: null, montant_convenu: null, displayConventionLabel: '', displayPartenaireLabel: '' });
            setError(null); setValidationErrors({}); setPartenaireError(null); setConventionError(null);

            // Fetch convention options
            setConventionLoading(true);
            axios.get(`${baseApiUrl}/conventions/options`, { withCredentials: true })
                .then(res => setConventionOptions(Array.isArray(res.data) ? res.data : (res.data.options || [])))
                .catch(err => setConventionError("Erreur chargement conventions."))
                .finally(() => setConventionLoading(false));
        }
    }, [baseApiUrl, isEditMode]); // Rerun if mode changes

    // Effect 2: Fetch Commitment Details (Only in Create Mode, when convention changes)
    useEffect(() => {
        if (!isEditMode && selectedConvention?.value) {
            // Reset partner state when convention changes
            setPartenaireOptions([]);
            setSelectedPartenaireOption(null);
            setConvPartDetails(prev => ({ ...prev, id_cp: null, montant_convenu: null, displayPartenaireLabel: '' })); // Keep existing displayConventionLabel
            setPartenaireError(null);
            setFormData(prev => ({ ...prev, montant_verse: '' }));
            clearValidationError('montant_verse');

            setPartenaireLoading(true);
            axios.get(`${baseApiUrl}/conventions/${selectedConvention.value}/commitment-details`, { withCredentials: true })
                 .then(res => {
                     const commitments = res.data || [];
                     const options = commitments.map(commit => {
                         const partner = commit.partenaire;
                         const idCp = commit.Id_CP;
                         const montantConvenu = parseFloat(commit.Montant_Convenu) || 0;
                         const totalVerse = parseFloat(commit.total_verse) || 0;
                         const reste = montantConvenu - totalVerse;
                         const tolerance = 0.001;
                         const isSold = totalVerse >= (montantConvenu - tolerance);
                         let statusLabel = isSold ? ' (Soldé)' : (reste > 0 ? ` (Reste: ${formatCurrency(reste)})` : (montantConvenu === 0 ? ' (Convenu: 0)' : ''));

                         return {
                             value: partner.Id, // Partner ID
                             label: `${partner?.Description || partner?.Description_Arr ||  `ID: ${partner?.Id}`}${statusLabel}`,
                             id_cp: idCp,
                             montant_convenu: montantConvenu,
                             is_sold: isSold
                         };
                     }).sort((a, b) => a.label.localeCompare(b.label));
                     setPartenaireOptions(options);
                 })
                 .catch(err => { setPartenaireError("Erreur chargement engagements."); setPartenaireOptions([]); })
                 .finally(() => setPartenaireLoading(false));
        } else if (!isEditMode && !selectedConvention?.value) {
            // Clear partner options if convention is cleared
             setPartenaireOptions([]);
             setSelectedPartenaireOption(null);
             setConvPartDetails(prev => ({ ...prev, id_cp: null, montant_convenu: null, displayPartenaireLabel: '' }));
             setPartenaireError(null);
        }
    }, [selectedConvention, baseApiUrl, isEditMode]); // Dependency: selectedConvention

    // Effect 3: Fetch Versement data (Only in Edit Mode)
    useEffect(() => {
        if (isEditMode && itemId) {
             // Reset form before loading edit data
             setFormData({ date_versement: '', montant_verse: '', moyen_paiement: '', reference_paiement: '', commentaire: '' });
             setSelectedConvention(null); setSelectedPartenaireOption(null); setPartenaireOptions([]);
             setConvPartDetails({ id_cp: null, montant_convenu: null, displayConventionLabel: '', displayPartenaireLabel: '' });
             setError(null); setValidationErrors({}); setPartenaireError(null); setConventionError(null);

             setIsLoading(true); // Use the general loading state
            axios.get(`${baseApiUrl}/versements/${itemId}`, { withCredentials: true })
                .then(response => {
                    const itemData = response.data.versement;
                    if (!itemData?.conv_part?.convention || !itemData?.conv_part?.partenaire) {
                        throw new Error("Données Convention/Partenaire liées manquantes.");
                    }
                    const formattedDate = itemData.date_versement ? new Date(itemData.date_versement).toISOString().split('T')[0] : '';
                    const convInfo = itemData.conv_part.convention;
                    const partInfo = itemData.conv_part.partenaire;

                    // Set form data fields
                    setFormData({
                        date_versement: formattedDate,
                        montant_verse: itemData.montant_verse || '',
                        moyen_paiement: itemData.moyen_paiement || '',
                        reference_paiement: itemData.reference_paiement || '',
                        commentaire: itemData.commentaire || ''
                    });

                    // Set details needed for validation/display AND the new display labels
                    setConvPartDetails({
                        id_cp: itemData.id_CP, // <<< Store the ID_CP
                        montant_convenu: itemData.conv_part.Montant_Convenu,
                        displayConventionLabel: `${convInfo.code} - ${truncateText(convInfo.intitule || '', 60)}`, // <<< Set display label
                        displayPartenaireLabel: partInfo.Description ||partInfo.Description_Arr  || `ID: ${partInfo.Id}`// <<< Set display label
                    });

                })
                .catch(err => { setError(err.response?.data?.message || err.message || "Erreur chargement du versement."); })
                .finally(() => setIsLoading(false));
        }
    }, [itemId, isEditMode, baseApiUrl]); // Rerun if itemId changes

    // --- Handlers ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        clearValidationError(name);
        // Re-validate amount if it changes
        if (name === 'montant_verse' && convPartDetails?.montant_convenu != null) {
            validateMontant(value, convPartDetails.montant_convenu);
        }
    };

    // Handler only for Create Mode Convention change
    const handleConventionChange = (selectedOption) => {
        if (isEditMode) return; // Should not happen if disabled, but good practice
        setSelectedConvention(selectedOption);
        // Reset partner state (done in useEffect for selectedConvention)
    };

    // Handler only for Create Mode Partenaire change
    const handlePartenaireChange = (selectedOption) => {
        if (isEditMode) return; // Should not happen if disabled, but good practice
        setSelectedPartenaireOption(selectedOption); // Store the full selected option

        if (selectedOption) {
            setConvPartDetails(prev => ({ // Keep existing displayConventionLabel
                ...prev,
                id_cp: selectedOption.id_cp,
                montant_convenu: selectedOption.montant_convenu,
                displayPartenaireLabel: '' // Clear display label in create mode
            }));
            if (formData.montant_verse) { // Revalidate amount if already entered
                validateMontant(formData.montant_verse, selectedOption.montant_convenu);
            }
        } else {
            setConvPartDetails(prev => ({ // Keep existing displayConventionLabel
                 ...prev,
                 id_cp: null,
                 montant_convenu: null,
                 displayPartenaireLabel: ''
            }));
            setFormData(prev => ({ ...prev, montant_verse: '' }));
            clearValidationError('montant_verse');
        }
    };

    const clearValidationError = (fieldName) => {
        if (validationErrors[fieldName]) {
            setValidationErrors(prev => { const n = { ...prev }; delete n[fieldName]; return n; });
        }
    };

    // Basic client-side check (backend check is primary)
    const validateMontant = (montant, limite) => {
        clearValidationError('montant_verse');
        if (montant === '' || montant == null) return true; // Allow empty during typing
        const montantNum = parseFloat(montant);

        if (isNaN(montantNum)) {
             setValidationErrors(prev => ({ ...prev, montant_verse: [`Format invalide.`] })); return false;
        }
        if (montantNum <= 0) {
            setValidationErrors(prev => ({ ...prev, montant_verse: [`Le montant doit être positif.`] }));
            return false;
        }
        // Optional: Add a basic check against the limit if needed, but rely on backend
        // const limiteNum = parseFloat(limite);
        // if (!isNaN(limiteNum) && montantNum > limiteNum) { ... }
        return true;
    };

    // --- Submit Handler ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setValidationErrors({});
        let isValid = true;
        const currentErrors = {};

        // Use the id_cp from convPartDetails state (set in useEffect or handlePartenaireChange)
        const currentIdCp = convPartDetails.id_cp;
        if (!currentIdCp) {
             // This error is less likely now, especially in edit mode, but keep as a fallback
             setError("L'engagement (Convention/Partenaire) n'a pas pu être identifié.");
             isValid = false;
        }

        // Basic required field checks
        if (!formData.date_versement) { currentErrors.date_versement = ["Date obligatoire."]; isValid = false; }
        if (!formData.montant_verse) { currentErrors.montant_verse = ["Montant obligatoire."]; isValid = false; }
        else if (!validateMontant(formData.montant_verse, convPartDetails.montant_convenu)) { isValid = false; }
        if (!formData.moyen_paiement) { currentErrors.moyen_paiement = ["Moyen obligatoire."]; isValid = false; }

        if (!isValid) { setValidationErrors(currentErrors); return; }

        setIsLoading(true);
        const url = isEditMode ? `${baseApiUrl}/versements/${itemId}` : `${baseApiUrl}/versements`;
        const method = isEditMode ? 'put' : 'post';
        // Ensure id_CP is included only for create, not needed for update route itself
        const payload = isEditMode ? { ...formData } : { ...formData, id_CP: currentIdCp };
        // If your update needs id_CP in payload, add it: const payload = { ...formData, id_CP: currentIdCp };

        try {
            const response = await axios({ method, url, data: payload, withCredentials: true });
            if (isEditMode) onItemUpdated(response.data.versement); else onItemCreated(response.data.versement);
            onClose(); // Close modal on success
        } catch (err) {
             const resData = err.response?.data;
             console.error("Error submitting versement:", err.response || err);
             if (err.response?.status === 422 && resData?.errors) {
                 setValidationErrors(resData.errors); // Set validation errors from backend
                 setError(resData.message || "Échec de la validation des données."); // Use backend message
             } else {
                 setError(resData?.message || err.message || `Échec de l'opération.`); // General error
             }
        } finally {
            setIsLoading(false);
        }
     };

     // --- Styles --- (Keep your existing styles)
     const selectStyles = { /* Your existing selectStyles */
        control: (provided, state) => ({ ...provided, backgroundColor: '#f8f9fa', borderRadius: '1.5rem', border: state.isFocused ? '1px solid #86b7fe' : '1px solid #ced4da', boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : 'none', minHeight: '38px', }), valueContainer: (provided) => ({ ...provided, padding: '0.25rem 0.8rem', }), input: (provided) => ({ ...provided, margin: '0px', padding: '0px', }), indicatorSeparator: () => ({ display: 'none', }), indicatorsContainer: (provided) => ({ ...provided, padding: '1px', }), placeholder: (provided) => ({ ...provided, color: '#6c757d', }), menu: (provided) => ({ ...provided, borderRadius: '0.5rem', boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)', zIndex: 1050 }), option: (provided, state) => ({ ...provided, backgroundColor: state.isSelected ? '#0d6efd' : state.isFocused ? '#e9ecef' : null, color: state.isSelected ? 'white' : 'black', }),
    };

    // --- Render ---
    return (
        // Keep Card structure if you like it
        <Card className='border-0 pt-2 rounded-5'>
            {/* Header can remain outside Form */}
            <Modal.Header className='d-flex justify-content-between border-0'>
                <Modal.Title>{isEditMode ? 'Modifier un Versement' : 'Ajouter un Versement'}</Modal.Title>
                <Button variant='warning' className='rounded-5 fw-bold px-5' onClick={onClose}>
                    Revenir a la liste
                </Button>
            </Modal.Header>

            <Form onSubmit={handleSubmit} noValidate className='py-2'>
                <Modal.Body>
                    {error && <Alert variant="danger" size="sm">{error}</Alert>}
                    {isLoading && <div className="text-center my-3"><Spinner animation="border" size="sm"/><span className="ms-2 small">Chargement...</span></div>}

                    {/* Render form only when not loading edit data */}
                    {!isLoading && (
                       <><Row className="g-3">
                            {/* 1. Convention Field */}
                            <Col md={6}> {/* Adjusted grid size */}
                                <Form.Group controlId="versementConvention">
                                    <Form.Label>Convention*</Form.Label>
                                    {isEditMode ? (
                                        <Form.Control
                                            className='rounded-5 px-3 py-2' // Apply consistent styling
                                            type="text"
                                            value={convPartDetails.displayConventionLabel}
                                            disabled
                                            readOnly // Indicate it's read-only
                                        />
                                    ) : (
                                        <Select
                                            options={conventionOptions}
                                            value={selectedConvention}
                                            onChange={handleConventionChange}
                                            placeholder="Sélectionner Convention..."
                                            isClearable
                                            isLoading={conventionLoading}
                                            styles={selectStyles}
                                            required
                                        />
                                    )}
                                    {conventionError && !conventionLoading && !isEditMode && <Form.Text className="text-danger small">{conventionError}</Form.Text>}
                                </Form.Group>
                            </Col>
                            

                            {/* 2. Partenaire/Commitment Field */}
                            <Col md={6}> {/* Adjusted grid size */}
                                <Form.Group controlId="versementPartenaire">
                                    <Form.Label>Partenaire (Engagement)*</Form.Label>
                                    {isEditMode ? (
                                        <Form.Control
                                             className='rounded-5 px-3 py-2' // Apply consistent styling
                                            type="text"
                                            value={convPartDetails.displayPartenaireLabel}
                                            disabled
                                            readOnly // Indicate it's read-only
                                        />
                                    ) : (
                                        <Select
                                            options={partenaireOptions}
                                            value={selectedPartenaireOption}
                                            onChange={handlePartenaireChange}
                                            placeholder={!selectedConvention ? "Choisir convention d'abord" : "Sélectionner Partenaire..."}
                                            isClearable
                                            isLoading={partenaireLoading}
                                            isDisabled={!selectedConvention || partenaireLoading}
                                            styles={selectStyles}
                                            noOptionsMessage={() => partenaireLoading ? 'Chargement...' : (!selectedConvention ? 'Choisir convention' : (partenaireError || 'Aucun partenaire/engagement'))}
                                            required
                                            isOptionDisabled={(option) => option.is_sold} // Prevent selecting paid ones
                                        />
                                    )}
                                    {partenaireError && !partenaireLoading && !isEditMode && <Form.Text className="text-danger small">{partenaireError}</Form.Text>}
                                    {partenaireLoading && !isEditMode && <div className="text-muted small mt-1"><Spinner animation="border" size="sm" /> Chargement engagements...</div>}
                                </Form.Group>
                            </Col>
</Row><Row>
                            {/* 3. Other Fields (Date, Montant, etc.) */}
                             <Col md={4}>
                                 <Form.Group controlId="versementDate">
                                     <Form.Label>Date Versement*</Form.Label>
                                     <Form.Control className='rounded-5 px-3 py-2' type="date" name="date_versement" value={formData.date_versement} onChange={handleChange} required isInvalid={!!validationErrors.date_versement} />
                                     <Form.Control.Feedback type="invalid">{validationErrors.date_versement?.[0]}</Form.Control.Feedback>
                                 </Form.Group>
                             </Col>

                            <Col md={4}>
                                <Form.Group controlId="versementMontant">
                                    <Form.Label>Montant Versé*</Form.Label>
                                    <InputGroup className='rounded-5' hasValidation>
                                        <Form.Control className='rounded-start-5 px-3 py-2' type="number" name="montant_verse" value={formData.montant_verse} onChange={handleChange} required step="0.01" min="0.01" isInvalid={!!validationErrors.montant_verse} placeholder="0.00"
                                            // Disable amount if no commitment selected in create mode
                                            disabled={!isEditMode && !convPartDetails.id_cp}
                                        />
                                        <InputGroup.Text className='rounded-end-5'>MAD</InputGroup.Text>
                                        <Form.Control.Feedback type="invalid">{validationErrors.montant_verse?.[0]}</Form.Control.Feedback>
                                    </InputGroup>
                                    {/* Display limit info */}
                                    {convPartDetails.montant_convenu != null && !validationErrors.montant_verse && (
                                        <Form.Text muted>Limite convenue: {formatCurrency(convPartDetails.montant_convenu)}</Form.Text>
                                    )}
                                    {/* Prompt to select relationship in create mode */}
                                    {!isEditMode && !convPartDetails.id_cp && (
                                        <Form.Text muted>Sélectionnez Convention/Partenaire.</Form.Text>
                                    )}
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group controlId="versementMoyen">
                                    <Form.Label>Moyen Paiement*</Form.Label>
                                    <Form.Select name="moyen_paiement" value={formData.moyen_paiement} onChange={handleChange} className='rounded-5 px-3 py-2' required isInvalid={!!validationErrors.moyen_paiement}>
                                        <option value="">Sélectionner...</option>
                                        {PAIEMENT_METHODE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                                    </Form.Select>
                                    <Form.Control.Feedback type="invalid">{validationErrors.moyen_paiement?.[0]}</Form.Control.Feedback>
                                </Form.Group>
                            </Col>
                            </Row><Row>
                            <Col md={6}>
                                <Form.Group controlId="versementReference">
                                    <Form.Label>Référence Paiement</Form.Label>
                                    <Form.Control className='rounded-5 px-3 py-2' type="text" name="reference_paiement" value={formData.reference_paiement} onChange={handleChange} isInvalid={!!validationErrors.reference_paiement} maxLength={100} placeholder="N° Chèque, ID Transaction..."/>
                                    <Form.Control.Feedback type="invalid">{validationErrors.reference_paiement?.[0]}</Form.Control.Feedback>
                                </Form.Group>
                            </Col>
                            <Col md={6}> {/* Changed grid size */}
                                <Form.Group controlId="versementCommentaire">
                                    <Form.Label>Commentaire</Form.Label>
                                    <Form.Control className='rounded-5 px-3 py-2' as="textarea" name="commentaire" rows={1} value={formData.commentaire} onChange={handleChange} isInvalid={!!validationErrors.commentaire}/>
                                    <Form.Control.Feedback type="invalid">{validationErrors.commentaire?.[0]}</Form.Control.Feedback>
                                </Form.Group>
                            </Col>
                            {/* Display general submission error if ID_CP was missing */}
                            {validationErrors.id_CP && <Col xs={12}><Alert variant="danger" size="sm">Erreur: {validationErrors.id_CP[0]}</Alert></Col>}
                        </Row>
                   </> ) }
                </Modal.Body>
                <Modal.Footer className='d-flex justify-content-center p-3 border-0'>
                    {/* Keep footer buttons */}
                     <Button variant="danger" onClick={onClose} disabled={isLoading || conventionLoading || partenaireLoading} className='px-5 rounded-5 m-2'> Annuler </Button>
                    <Button variant="primary" type="submit" disabled={isLoading || conventionLoading || partenaireLoading || (!isEditMode && !convPartDetails.id_cp)} className='px-5 m-2 rounded-5'>
                        {isLoading ? <Spinner as="span" animation="border" size="sm" /> : (isEditMode ? 'Enregistrer' : 'Ajouter')}
                    </Button>
                </Modal.Footer>
            </Form>
        </Card>
    );
};

// --- PropTypes --- (Keep your PropTypes)
VersementForm.propTypes = { /* ... */ };

export default VersementForm;