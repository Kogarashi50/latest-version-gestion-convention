import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle, faTimes, faPlus, faTrashAlt, faPaperclip } from '@fortawesome/free-solid-svg-icons';
import Select from 'react-select';
import { Form, Button, Row, Col, Card, Alert, Spinner, InputGroup, Badge, Stack, FormCheck } from 'react-bootstrap';
import PropTypes from 'prop-types';

// Styles for react-select (ensure these don't conflict with other global styles)
const selectStyles = {
    control: (provided, state) => ({
        ...provided,
        backgroundColor: '#f8f9fa',
        borderRadius: '1.5rem',
        border: state.isFocused ? '1px solid #86b7fe' : '1px solid #ced4da',
        boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : 'none',
        minHeight: '38px',
    }),
    valueContainer: (provided) => ({
        ...provided,
        padding: '0.25rem 0.8rem',
    }),
    input: (provided) => ({
        ...provided,
        margin: '0px',
        padding: '0px',
    }),
    indicatorSeparator: () => ({
        display: 'none',
    }),
    indicatorsContainer: (provided) => ({
        ...provided,
        padding: '1px',
    }),
    placeholder: (provided) => ({
        ...provided,
        color: '#6c757d',
    }),
    menu: (provided) => ({ // Styles for the dropdown menu itself
        ...provided,
        borderRadius: '0.5rem',
        boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
        zIndex: 1050, // Ensure menu appears above other elements (adjust if needed)
    }),
    menuPortal: base => ({ // Ensure portal has high z-index
        ...base,
        zIndex: 9999 // High z-index for portal target
    }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? '#0d6efd' : state.isFocused ? '#e9ecef' : null,
        color: state.isSelected ? 'white' : 'black',
    }),
    // Add styles for multi-value
    multiValue: (provided) => ({
        ...provided,
        backgroundColor: '#e9ecef',
        borderRadius: '0.5rem',
        margin: '2px', // Add some spacing for multi-values
    }),
    multiValueLabel: (provided) => ({
        ...provided,
        color: '#495057',
        padding: '2px 5px',
    }),
    multiValueRemove: (provided) => ({
        ...provided,
        color: '#6c757d',
        ':hover': {
            backgroundColor: '#dc3545', // Example hover effect
            color: 'white',
        },
    }),
};

// Helper to parse currency input back to number
const parseCurrency = (value) => {
    if (typeof value !== 'string') return Number(value) || null;
    const cleaned = value.replace(/[\s\u00A0]/g, '').replace(/[^0-9,.-]/g, '').replace(',', '.');
    const number = parseFloat(cleaned);
    return isNaN(number) ? null : number;
};

// --- Component ---
const AvenantForm = ({
    itemId = null,
    onClose,
    onItemCreated,
    onItemUpdated,
    initialConventionId = null,
    baseApiUrl = 'http://192.168.30.241:81/api'
}) => {
    // --- State ---
    const initialFormData = useMemo(() => ({
        convention_id: initialConventionId || '',
        numero_avenant: '',
        date_signature: '',
        objet: '',
        type_modification: null,
        montant_modifie: '',
        nouvelle_date_fin: '',
        remarques: '',
    }), [initialConventionId]);

    const [formData, setFormData] = useState(initialFormData);
    const [conventionOptions, setConventionOptions] = useState([]);
    const [partenaireOptions, setPartenaireOptions] = useState([]);
    const [avenantPartnerDetails, setAvenantPartnerDetails] = useState([]);
    const [typeModificationOptions] = useState([
        { value: 'montant', label: 'Modification Montant' },
        { value: 'durée', label: 'Modification Durée' },
        { value: 'partenaire', label: 'Modification Partenaire(s)' },
        { value: 'autre', label: 'Autre Modification' },
    ]);
    const [fichiers, setFichiers] = useState([]);
    const [existingFichiers, setExistingFichiers] = useState([]);
    const [fichiersToDelete, setFichiersToDelete] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState({ conventions: true, partenaires: true });
    const [submissionStatus, setSubmissionStatus] = useState({ loading: false, error: null, success: false });
    const [formErrors, setFormErrors] = useState({});
    const [loadingData, setLoadingData] = useState(!!itemId);
    const isEditing = useMemo(() => itemId !== null, [itemId]);
    const optionsFinishedLoading = useMemo(() => !loadingOptions.conventions && !loadingOptions.partenaires, [loadingOptions]);

    // --- Fetch Options ---
    const fetchOptions = useCallback(async () => {
        console.log("Fetching options...");
        setLoadingOptions({ conventions: true, partenaires: true });
        try {
            const [convRes, partRes] = await Promise.all([
                axios.get(`${baseApiUrl}/conventions`, { params: { light: true }, withCredentials: true }),
                axios.get(`${baseApiUrl}/partenaires`, { withCredentials: true })
            ]);

            const conventions = Array.isArray(convRes.data?.conventions) ? convRes.data.conventions : [];
            const mappedConvOptions = conventions
                .filter(c => c?.id !== undefined && c?.Code !== undefined && c?.Intitule !== undefined)
                .map(c => ({ value: c.id, label: `${c.Code} - ${c.Intitule}` }))
                .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }));
            setConventionOptions(mappedConvOptions);
            console.log("Convention Options Loaded:", mappedConvOptions.length);

            const partenaires = Array.isArray(partRes.data?.partenaires) ? partRes.data.partenaires : [];
            const mappedPartOptions = partenaires
                .filter(p => p?.Id !== undefined && p?.Description !== undefined)
                .map(p => ({ value: p.Id, label: p.Description }))
                .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }));
            setPartenaireOptions(mappedPartOptions);
            console.log("Partenaire Options Loaded:", mappedPartOptions.length);

        } catch (err) {
            console.error("Erreur chargement options:", err);
            setSubmissionStatus(prev => ({ ...prev, error: "Erreur chargement des listes." }));
            setConventionOptions([]);
            setPartenaireOptions([]);
        } finally {
            setLoadingOptions({ conventions: false, partenaires: false });
            console.log("Finished fetching options.");
        }
    }, [baseApiUrl]);

    useEffect(() => { fetchOptions(); }, [fetchOptions]);

    // --- EFFECT 1: Fetch Avenant Data for Editing ---
    useEffect(() => {
        if (!isEditing || !itemId || !optionsFinishedLoading) {
            setLoadingData(false);
            return;
        }

        let isMounted = true;
        const fetchAvenantData = async () => {
            console.log(`[Avenant Form] Fetching edit data ID: ${itemId}`);
            setLoadingData(true);
            setSubmissionStatus({ loading: false, error: null, success: false });
            setFormErrors({});

            try {
                // Use the confirmed working include parameter
                const response = await axios.get(`${baseApiUrl}/avenants/${itemId}`, {
                    params: { include: 'convention,documents,partnerCommitments.partenaire' }, // Ensure this is correct
                    withCredentials: true
                });
                // Check response structure carefully
                const data = response.data.avenant || response.data; // Access nested 'avenant' if present

                if (!isMounted || !data) {
                    if (isMounted) throw new Error("Avenant non trouvé ou données invalides.");
                    return;
                }
                // Log the EXACT data received from the API
                console.log("[Avenant Form Load] Raw Data Received:", data);

                const selectedTypeOption = typeModificationOptions.find(opt => opt.value === data.type_modification) || null;

                setFormData({
                    convention_id: data.convention_id || '',
                    numero_avenant: data.numero_avenant || '',
                    date_signature: data.date_signature || '',
                    objet: data.objet || '',
                    type_modification: selectedTypeOption,
                    montant_modifie: data.montant_modifie || '',
                    nouvelle_date_fin: data.nouvelle_date_fin || '',
                    remarques: data.remarques || '',
                });

                const fetchedFiles = Array.isArray(data.documents) ? data.documents : [];
                setExistingFichiers(fetchedFiles.map(f => ({
                    id: f.Id_Doc,
                    file_name: f.file_name,
                    fichier_url: f.fichier_url
                })));
                console.log("[Avenant Form Load] Existing files loaded:", existingFichiers.length);

                // --- Process Partner Commitments ---
                // Ensure 'partnerCommitments' key exists and is an array
                const fetchedCommitments = data.partner_commitments || []; 
                console.log("[Avenant Form Load] Fetched Commitments Array:", fetchedCommitments);

                if (!Array.isArray(fetchedCommitments)) {
                     console.error("Fetched commitments is not an array!", fetchedCommitments);
                     setAvenantPartnerDetails([]); // Set empty if data is invalid
                } else {
                    const initialPartnerDetails = fetchedCommitments.map((commit, index) => {
                        console.log(`[Avenant Form Load] Mapping commitment #${index}:`, commit); // Log each raw commitment
                        const partnerInfo = commit.partenaire; // Get nested partner
                        if (!partnerInfo || !partnerInfo.Id || !partnerInfo.Description) { // Check nested partner data more thoroughly
                            console.warn(`[Avenant Form Load] Partner info missing or incomplete for commitment #${index}:`, commit);
                            return null; // Skip if essential partner info is missing
                        }

                        // Create the mapped object
                        const mappedDetail = {
                            id: commit.Id_Partenaire,
                            label: partnerInfo.Description || `ID ${commit.Id_Partenaire}`, // Fallback label
                            // Ensure keys match EXACTLY what's in the JSON response
                            montant: String(commit.Montant_Convenu ?? ''), // Check 'Montant_Convenu' casing
                            is_signatory: !!commit.is_signatory,           // Check 'is_signatory' casing/value (true/false or 1/0?)
                            date_signature: commit.date_signature || '',   // Check 'date_signature' casing
                            details_signature: commit.details_signature || '' // Check 'details_signature' casing
                        };
                        console.log(`[Avenant Form Load] Mapped detail #${index}:`, mappedDetail); // Log the result of mapping
                        return mappedDetail;

                    }).filter(p => p && p.id); // Filter out nulls if mapping failed

                    setAvenantPartnerDetails(initialPartnerDetails);
                    console.log("[Avenant Form Load] Final Mapped 'avenantPartnerDetails' State:", initialPartnerDetails);
                }


                setFichiers([]);
                setFichiersToDelete([]);

            } catch (err) {
                console.error("Erreur chargement données avenant:", err.response?.data || err.message || err);
                if (isMounted) setSubmissionStatus({ loading: false, error: err.response?.data?.message || err.message || "Erreur chargement données.", success: false });
            } finally {
                if (isMounted) setLoadingData(false);
            }
        };

        fetchAvenantData();

        return () => { isMounted = false; };
    }, [itemId, isEditing, baseApiUrl, optionsFinishedLoading, typeModificationOptions]); // Added typeModificationOptions dependency

    // --- EFFECT 2: Reset Form ---
    useEffect(() => {
        if (!isEditing) {
            setFormData(initialFormData);
            setFichiers([]);
            setExistingFichiers([]);
            setFichiersToDelete([]);
            setAvenantPartnerDetails([]); // Reset Partner Details
            setFormErrors({});
            setSubmissionStatus({ loading: false, error: null, success: false });
            setLoadingData(false);
        }
    }, [isEditing, initialFormData]); // Removed initialConventionId dependency - handled in initialFormData useMemo

    // --- Frontend Validation ---
    const validateForm = useCallback(() => { // Wrap in useCallback if needed, dependencies are tricky here
        const errors = {};
        if (!formData.convention_id) errors.convention_id = "Convention requise.";
        if (!formData.numero_avenant?.trim()) errors.numero_avenant = "Numéro avenant requis.";
        if (!formData.date_signature) errors.date_signature = "Date signature requise.";
        if (!formData.objet?.trim()) errors.objet = "Objet requis.";
        if (!formData.type_modification) errors.type_modification = "Type modification requis.";

        if (formData.type_modification?.value === 'montant') {
             const montant = parseCurrency(formData.montant_modifie);
             if (montant === null || isNaN(montant) || montant < 0) errors.montant_modifie = "Montant invalide.";
        }
        if (formData.type_modification?.value === 'durée') {
             if (!formData.nouvelle_date_fin) errors.nouvelle_date_fin = "Nouvelle date fin requise.";
        }
        if (formData.type_modification?.value === 'partenaire') {
            if (!avenantPartnerDetails || avenantPartnerDetails.length === 0) {
                errors.partenaires = "Au moins un partenaire doit être sélectionné pour ce type.";
            } else {
                avenantPartnerDetails.forEach((p) => {
                    // Montant validation: Check if it's not empty AND invalid
                    if (p.montant !== '' && p.montant !== null && p.montant !== undefined) {
                       const amount = parseCurrency(String(p.montant)); // Ensure it's a string for parseCurrency
                       if (amount === null || isNaN(amount) || amount < 0) {
                           errors[`montant_${p.id}`] = `Montant invalide pour ${p.label}.`;
                       }
                    }
                    // Date required only if signatory is checked
                    if (p.is_signatory && !p.date_signature) {
                        errors[`date_sig_${p.id}`] = `Date signature requise pour ${p.label} (signataire).`;
                    }
                });
            }
        }

        // File validation (only require file on create or if all existing are marked for delete)
        // const remainingFilesCount = existingFichiers.length - fichiersToDelete.length;
        // if (!isEditing && fichiers.length === 0) {
        //     errors.fichiers = "Au moins un fichier requis pour un nouvel avenant.";
        // } else if (isEditing && fichiers.length === 0 && remainingFilesCount <= 0) {
        //     errors.fichiers = "Au moins un fichier doit rester ou être ajouté.";
        // fichiers, existingFichiers, fichiersToDelete,
        // }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }, [formData, avenantPartnerDetails, isEditing]); // Add dependencies

    // --- Handlers ---
    const handleChange = useCallback((e) => {
         const { name, value } = e.target;
         setFormData(prev => ({ ...prev, [name]: value }));
         // Clear specific error when field changes
         if (formErrors[name]) {
            setFormErrors(prev => {
                const nextErrors = { ...prev };
                delete nextErrors[name];
                return nextErrors;
            });
         }
    }, [formErrors]); // Add formErrors dependency

    const handleSelectChange = useCallback((selectedOption, actionMeta) => {
        const { name } = actionMeta;
        const value = (name === 'convention_id') ? (selectedOption ? selectedOption.value : '') : selectedOption;

        setFormData(prev => ({ ...prev, [name]: value }));

        // --- Reset conditional fields and errors when type changes ---
        if (name === 'type_modification') {
             const typeValue = selectedOption?.value;
             // Reset form data fields not relevant to the new type
             setFormData(prevData => ({
                 ...prevData,
                 montant_modifie: typeValue === 'montant' ? prevData.montant_modifie : '',
                 nouvelle_date_fin: typeValue === 'durée' ? prevData.nouvelle_date_fin : '',
             }));
             // Reset partner details if type is not 'partenaire'
             if (typeValue !== 'partenaire') {
                 setAvenantPartnerDetails([]);
             }
        }

        // --- Clear errors related to the changed select ---
        setFormErrors(prev => {
            const nextErrors = { ...prev };
            delete nextErrors[name];
            // Also clear conditional field errors if type changed
            if (name === 'type_modification') {
                const typeValue = selectedOption?.value;
                 if (typeValue !== 'montant') delete nextErrors.montant_modifie;
                 if (typeValue !== 'durée') delete nextErrors.nouvelle_date_fin;
                 if (typeValue !== 'partenaire') {
                      delete nextErrors.partenaires;
                      // Remove partner-specific errors
                      Object.keys(nextErrors).forEach(key => {
                          if (key.startsWith('montant_') || key.startsWith('date_sig_')) {
                              delete nextErrors[key];
                          }
                      });
                 }
            }
            return nextErrors;
        });

     }, []); // Empty dependency array might be okay if only using setFormData/setFormErrors

     const handleAvenantPartnerSelectionChange = useCallback((selectedOptions) => {
        const newSelectedPartners = selectedOptions || [];
        // Update details, preserving existing info where possible
        setAvenantPartnerDetails(prevDetails => {
            const prevDetailsMap = new Map(prevDetails.map(p => [p.id, p]));
            return newSelectedPartners.map(option => {
                const existingDetails = prevDetailsMap.get(option.value);
                return {
                    id: option.value,
                    label: option.label,
                    montant: existingDetails?.montant ?? '', // Use existing or default
                    is_signatory: existingDetails?.is_signatory ?? false,
                    date_signature: existingDetails?.date_signature ?? '',
                    details_signature: existingDetails?.details_signature ?? '',
                };
            });
        });
        // Clear general partner error if partners are now selected
        if (formErrors.partenaires && newSelectedPartners.length > 0) {
           setFormErrors(prev => ({ ...prev, partenaires: undefined }));
        }
    }, [formErrors.partenaires]); // Dependency needed

    // Handlers for inputs *within* the partner details section
    const handleAvenantCommitmentChange = useCallback((partnerId, value) => {
        setAvenantPartnerDetails(prevDetails =>
            prevDetails.map(p => (p.id === partnerId ? { ...p, montant: value } : p))
        );
        // Clear validation error for this specific partner's montant
        const errorKey = `montant_${partnerId}`;
        if (formErrors[errorKey]) {
            setFormErrors(prev => {
                 const nextErrors = { ...prev };
                 delete nextErrors[errorKey];
                 return nextErrors;
             });
        }
    }, [formErrors]);

    const handleAvenantSignatoryChange = useCallback((partnerId, isChecked) => {
        setAvenantPartnerDetails(prevDetails =>
            prevDetails.map(p => (p.id === partnerId ? {
                 ...p,
                 is_signatory: isChecked,
                 // Reset date/details if unchecked
                 date_signature: isChecked ? p.date_signature : '',
                 details_signature: isChecked ? p.details_signature : ''
                } : p))
        );
         // Clear date error if unchecked
         const dateErrorKey = `date_sig_${partnerId}`;
         if (!isChecked && formErrors[dateErrorKey]) {
             setFormErrors(prev => {
                 const nextErrors = { ...prev };
                 delete nextErrors[dateErrorKey];
                 return nextErrors;
             });
         }
    }, [formErrors]);

    const handleAvenantSignatureDateChange = useCallback((partnerId, value) => {
        setAvenantPartnerDetails(prevDetails =>
            prevDetails.map(p => (p.id === partnerId ? { ...p, date_signature: value } : p))
        );
        // Clear validation error for this specific partner's date
        const errorKey = `date_sig_${partnerId}`;
        if (formErrors[errorKey]) {
             setFormErrors(prev => {
                 const nextErrors = { ...prev };
                 delete nextErrors[errorKey];
                 return nextErrors;
             });
        }
    }, [formErrors]);

     const handleAvenantSignatureDetailsChange = useCallback((partnerId, value) => {
         setAvenantPartnerDetails(prevDetails =>
             prevDetails.map(p => (p.id === partnerId ? { ...p, details_signature: value } : p))
         );
     }, []);

    // File Handlers (memoized)
    const handleFileChange = useCallback((e) => {
        const filesToAdd = Array.from(e.target.files ?? []);
        if (!filesToAdd.length) return;
        setFichiers(prev => {
            const existingNames = new Set(prev.map(f => f.name));
            const uniqueNewFiles = filesToAdd.filter(f => !existingNames.has(f.name));
            return [...prev, ...uniqueNewFiles];
        });
        e.target.value = null; // Reset input field
        // Clear file errors
        if (formErrors.fichiers || formErrors['fichiers.*']) {
             setFormErrors(prev => ({ ...prev, 'fichiers': undefined, 'fichiers.*': undefined }));
        }
     }, [formErrors.fichiers, formErrors['fichiers.*']]); // Dependencies

    const removeNewFile = useCallback((fileIndex) => {
        setFichiers(prev => prev.filter((_, fIdx) => fIdx !== fileIndex));
        // Re-evaluate validation if needed (e.g., if this was the only file)
        // This logic depends heavily on specific validation requirements
     }, []);

    const removeExistingFile = useCallback((fileId) => {
        if (!window.confirm("Supprimer ce fichier existant ? Cette action marquera le fichier pour suppression lors de l'enregistrement.")) return;
        // Optimistic UI update: remove from display list
        // We don't modify existingFichiers here, just add to delete list
        // The display logic will need to account for this, or we filter existingFichiers
        // For simplicity, let's filter the display list but remember to send the ID for deletion
        // setExistingFichiers(prev => prev.filter(f => f.id !== fileId)); // Option 1: Remove from display
        setFichiersToDelete(prev => [...new Set([...prev, fileId])]); // Add ID to delete list (use Set to avoid duplicates)

        // You might want to visually indicate the file is marked for deletion instead of removing it
        // Or, keep it simple and remove from display, then handle potential re-validation:
        // const remainingVisibleFiles = existingFichiers.filter(f => !fichiersToDelete.includes(f.id) && f.id !== fileId).length;
        // if (fichiers.length === 0 && remainingVisibleFiles === 0) {
        //      setFormErrors(prev => ({ ...prev, fichiers: "Au moins un fichier doit rester ou être ajouté." }));
        // } else if (formErrors.fichiers) {
        //      setFormErrors(prev => ({ ...prev, fichiers: undefined })); , fichiers.length, formErrors.fichiers
        // }
     }, [existingFichiers, fichiersToDelete]); // Dependencies


    // --- Submit Handler ---
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!validateForm()) { // Use the memoized validator
             setSubmissionStatus({ loading: false, error: "Veuillez corriger les erreurs indiquées.", success: false });
             // Focus logic (optional improvement)
             const firstErrorKey = Object.keys(formErrors)[0];
             let errorElement;
             if (firstErrorKey) {
                 const partnerMatch = firstErrorKey.match(/^(montant|date_sig)_(\d+)$/);
                 if (partnerMatch) {
                     errorElement = document.getElementById(`formAvenantDetail_${partnerMatch[2]}`);
                 } else {
                     const capKey = firstErrorKey.charAt(0).toUpperCase() + firstErrorKey.slice(1);
                     errorElement = document.getElementById(`form${capKey}`) || document.querySelector(`[name="${firstErrorKey}"]`) || document.querySelector('.is-invalid');
                 }
                 errorElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
             }
             return;
        }

        setSubmissionStatus({ loading: true, error: null, success: false });
        const dataToSubmit = new FormData();

        // Append standard fields from formData state
        Object.entries(formData).forEach(([key, value]) => {
            if (key === 'type_modification') {
                dataToSubmit.append(key, value?.value || ''); // Send value if object, else empty
            } else if (key === 'montant_modifie' && formData.type_modification?.value === 'montant') {
                const montant = parseCurrency(value);
                if (montant !== null) dataToSubmit.append(key, montant); else dataToSubmit.append(key, ''); // Send empty if invalid/null
            } else if (key === 'nouvelle_date_fin' && formData.type_modification?.value === 'durée') {
                 if (value) dataToSubmit.append(key, value); else dataToSubmit.append(key, '');
            } else if (key !== 'montant_modifie' && key !== 'nouvelle_date_fin') { // Exclude conditional fields handled above
                dataToSubmit.append(key, value ?? ''); // Ensure null becomes empty string
            }
        });

        // Append NEW Files
        fichiers.forEach((file, index) => dataToSubmit.append(`fichiers[${index}]`, file, file.name));
        // Append IDs of files marked for deletion
        if (fichiersToDelete.length > 0) {
             fichiersToDelete.forEach((id, index) => dataToSubmit.append(`fichiers_to_delete[${index}]`, id));
        }

        // Append partner commitments if type is 'partenaire'
        if (formData.type_modification?.value === 'partenaire') {
            // Use the current avenantPartnerDetails state
            const partnerCommitmentsToSend = avenantPartnerDetails.map(p => ({
                id: p.id,
                montant: parseCurrency(String(p.montant)) ?? null, // Parse and send null if invalid/empty
                is_signatory: p.is_signatory,
                date_signature: p.is_signatory && p.date_signature ? p.date_signature : null,
                details_signature: p.is_signatory && p.details_signature ? p.details_signature : null,
            }));
            dataToSubmit.append('avenant_partner_commitments', JSON.stringify(partnerCommitmentsToSend));
            console.log("Appending avenant_partner_commitments:", JSON.stringify(partnerCommitmentsToSend));
        }

        // Append _method for PUT request if editing
        if (isEditing) {
            dataToSubmit.append('_method', 'PUT');
        }

        console.log("[Avenant Form] Submitting Data...");
        // Debug: Log FormData entries
        // for (let pair of dataToSubmit.entries()) { console.log(pair[0]+ ': '+ pair[1]); }

        const url = isEditing ? `${baseApiUrl}/avenants/${itemId}` : `${baseApiUrl}/avenants`;
        const config = {
            headers: { 'Content-Type': 'multipart/form-data', 'Accept': 'application/json' },
            withCredentials: true
        };

        try {
            const response = await axios.post(url, dataToSubmit, config);
            setSubmissionStatus({ loading: false, error: null, success: true });

            // Callbacks on success
            if (isEditing && onItemUpdated) {
                 console.log("Calling onItemUpdated with:", response.data.avenant);
                 onItemUpdated(response.data.avenant);
            } else if (!isEditing && onItemCreated) {
                 console.log("Calling onItemCreated with:", response.data.avenant);
                 onItemCreated(response.data.avenant);
            }
            // Close form after delay
            setTimeout(onClose, 1500);

        } catch (err) {
             console.error(`Erreur soumission avenant:`, err.response || err);
             const errorMsg = err.response?.data?.message || err.message || "Erreur serveur.";
             let serverErrors = err.response?.data?.errors || {}; // Get validation errors
             const mappedErrors = {};

             if (err.response?.status === 422 && typeof serverErrors === 'object') {
                 // Map server validation errors back to form fields
                 for (const key in serverErrors) {
                     if (key.startsWith('fichiers.')) {
                         mappedErrors['fichiers'] = (mappedErrors['fichiers'] || '') + serverErrors[key].join(' ');
                     } else if (key.startsWith('avenant_partner_commitments.')) {
                        const match = key.match(/\.(\d+)\.?(.*)?/); // Match index and optional field name
                        const errMessage = serverErrors[key].join(' ');
                        if (match && avenantPartnerDetails[match[1]]) {
                            const partnerId = avenantPartnerDetails[match[1]].id;
                            const fieldName = match[2];
                            // Map specific errors
                            if (fieldName === 'montant' || errMessage.toLowerCase().includes('montant')) {
                                 mappedErrors[`montant_${partnerId}`] = errMessage;
                            } else if (fieldName === 'date_signature' || errMessage.toLowerCase().includes('date signature') || errMessage.toLowerCase().includes('date_signature')) {
                                 mappedErrors[`date_sig_${partnerId}`] = errMessage;
                            } else {
                                mappedErrors['partenaires'] = (mappedErrors['partenaires'] || '') + `Erreur Part. ${match[1]+1}: ${errMessage} `;
                            }
                        } else {
                             mappedErrors['partenaires'] = (mappedErrors['partenaires'] || '') + errMessage + ' '; // General error
                        }
                     } else {
                         mappedErrors[key] = serverErrors[key].join(' '); // Standard field errors
                     }
                 }
                 setFormErrors(mappedErrors);
                 console.log("Mapped Server Errors:", mappedErrors);
             } else {
                 setFormErrors({}); // Clear errors for non-validation issues
             }
             setSubmissionStatus({ loading: false, error: errorMsg, success: false });
         }
    }, [isEditing, itemId, baseApiUrl, formData, fichiers, fichiersToDelete, avenantPartnerDetails, validateForm, onClose, onItemCreated, onItemUpdated]); // Include all dependencies

    // Disable submit button logic
    const isSubmitDisabled = submissionStatus.loading || loadingData || !optionsFinishedLoading;

    // --- Render Logic ---
    if (loadingData || !optionsFinishedLoading) {
         return ( <div className="d-flex justify-content-center align-items-center p-5" style={{minHeight: '400px'}}> <Spinner animation="border" variant="primary" /> <span className='ms-3 text-muted'>Chargement...</span> </div> );
    }

    // Filter existing files to display (don't show those marked for deletion)
    const visibleExistingFichiers = existingFichiers.filter(f => !fichiersToDelete.includes(f.id));

    return (
        <div className="p-3 p-md-4 avenant-form-container bg-white" style={{ borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 'calc(90vh - 100px)'}}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
                 <div><h5 className="text-uppercase fw-bold text-secondary mb-1">{isEditing ? 'Modifier' : 'Ajouter un nouveau'}</h5><h2 className="mb-0 fw-bold">Avenant</h2></div>
                 <Button variant="warning" className='btn rounded-5 fw-bold px-5 py-2 bg-warning shadow-sm' onClick={onClose} size="sm" title="Retour">Revenir a la liste</Button>
            </div>

            {/* Form Content */}
            <div className="flex-grow-1">
                 {submissionStatus.error && !submissionStatus.loading && (
                    <Alert variant="danger" className="mb-3 py-2 d-flex align-items-center">
                         <FontAwesomeIcon icon={faExclamationTriangle} className="me-2"/> {submissionStatus.error}
                    </Alert>
                 )}
                 {submissionStatus.success && (
                    <Alert variant="success" className="mb-3 py-2">Avenant {isEditing ? 'modifié' : 'ajouté'} avec succès !</Alert>
                 )}

                <Form noValidate onSubmit={handleSubmit} className='px-5 py-1 d-flex justify-content-center rounded-5  flex-column'>
                    {/* Convention Select */}
                   
                    <Form.Group as={Row} className="my-2" controlId="formConvention_id">
                        <Form.Label column sm={2} className="small fw-medium text-sm-end">Convention <span className="text-danger">*</span></Form.Label>
                        <Col sm={9}>
                            <Select
                                inputId='convention-select-input'
                                name="convention_id"
                                options={conventionOptions}
                                value={conventionOptions.find(opt => opt.value === formData.convention_id) || null}
                                onChange={handleSelectChange}
                                styles={selectStyles}
                                placeholder="- Sélectionner -"
                                isClearable={false}
                                isDisabled={loadingOptions.conventions || isEditing} // Convention cannot be changed when editing
                                isLoading={loadingOptions.conventions}
                                isInvalid={!!formErrors.convention_id} // Add isInvalid prop
                                className={formErrors.convention_id ? 'is-invalid' : ''} // Keep class for visual cue
                                classNamePrefix="react-select"
                                menuPortalTarget={document.body} // Ensure dropdown appears above modal/container
                                menuPlacement="auto"
                             />
                             {formErrors.convention_id && <div className="invalid-feedback d-block ps-1 small">{formErrors.convention_id}</div>}
                        </Col>
                    </Form.Group>
                    <Row className='d-flex justify-content-center my-2 w-100 align-self-between'>
                    {/* Numero Avenant */}
                    <Col sm={1}></Col>
                    <Form.Group as={Col}  className="" controlId="formNumero_avenant">
                        <Row>
                        <Col sm={3}>
                        <Form.Label  className="small fw-medium text-sm-end">N° Avenant <span className="text-danger">*</span></Form.Label></Col>
                        <Col sm={9}>
                            <Form.Control  
                                className="p-2 rounded-pill shadow-sm bg-white border-1"
                                isInvalid={!!formErrors.numero_avenant}
                                required
                                type="text"
                                name="numero_avenant"
                                value={formData.numero_avenant}
                                onChange={handleChange}
                                size="sm"
                                placeholder="Ex: Avenant N°1"
                             />
                            
                            <Form.Control.Feedback type="invalid">{formErrors.numero_avenant}</Form.Control.Feedback>
                            </Col> </Row>
                    </Form.Group>

                    {/* Date Signature */}
                    <Form.Group as={Col}  className="" controlId="formDate_signature">
                    <Row>
                    <Col sm={4}>
                    <Form.Label className="small fw-medium text-sm-end">Date Signature<span className="text-danger">*</span></Form.Label></Col>
                    <Col sm={8}>
                            <Form.Control
                                className="p-2 rounded-pill shadow-sm bg-white border-1"
                                isInvalid={!!formErrors.date_signature}
                                required
                                type="date"
                                name="date_signature"
                                value={formData.date_signature}
                                onChange={handleChange}
                                size="sm"
                             />
                            <Form.Control.Feedback type="invalid">{formErrors.date_signature}</Form.Control.Feedback>
                            </Col>
                            </Row>
                    </Form.Group>
                    <Col sm={1}></Col>

                    </Row>
                    {/* Objet */}
                     <Form.Group as={Row} className="my-2" controlId="formObjet">
                         <Form.Label column sm={2} className="small fw-medium text-sm-end">Objet <span className="text-danger">*</span></Form.Label>
                         <Col sm={10}>
                            <Form.Control
                                className="p-3 rounded-3 shadow-sm bg-white border-1 rounded-5 "
                                isInvalid={!!formErrors.objet}
                                required
                                as="textarea"
                                rows={2}
                                name="objet"
                                value={formData.objet}
                                onChange={handleChange}
                                size="sm"
                                placeholder="Description modifications..."
                             />
                            <Form.Control.Feedback type="invalid">{formErrors.objet}</Form.Control.Feedback>
                         </Col>
                    </Form.Group>

                    {/* Type Modification */}
                     <Form.Group as={Row} className="my-2 align-items-center" controlId="formType_modification">
                        <Form.Label column sm={2} className="small fw-medium text-sm-end">Type Modification <span className="text-danger">*</span></Form.Label>
                        <Col sm={10}>
                             <Select
                                 inputId='type-modif-select-input'
                                 name="type_modification"
                                 options={typeModificationOptions}
                                 value={formData.type_modification}
                                 onChange={handleSelectChange}
                                 styles={selectStyles}
                                 placeholder="- Sélectionner Type -"
                                 isClearable
                                 isInvalid={!!formErrors.type_modification} // Add isInvalid prop
                                 className={formErrors.type_modification ? 'is-invalid' : ''} // Keep class for visual cue
                                 classNamePrefix="react-select"
                                 menuPortalTarget={document.body}
                                 menuPlacement="auto"
                             />
                             {formErrors.type_modification && <div className="invalid-feedback d-block ps-1 small">{formErrors.type_modification}</div>}
                         </Col>
                    </Form.Group>

                     {/* --- Conditional Fields Display --- */}

                    {/* Montant Modifié */}
                    {formData.type_modification?.value === 'montant' && (
                        <Form.Group as={Row} className="mb-3 align-items-center" controlId="formMontant_modifie">
                           <Form.Label column sm={2} className="small fw-medium text-sm-end">Nouveau Montant <span className="text-danger">*</span></Form.Label>
                            <Col sm={10}>
                                <InputGroup size="sm">
                                     <Form.Control
                                         className="p-2 rounded-start-pill shadow-sm bg-white border-1"
                                         isInvalid={!!formErrors.montant_modifie}
                                         required
                                         type="number"
                                         step="0.01"
                                         min="0"
                                         name="montant_modifie"
                                         value={formData.montant_modifie}
                                         onChange={handleChange}
                                         placeholder="0.00"
                                     />
                                     <InputGroup.Text className="rounded-end-pill">MAD</InputGroup.Text>
                                     <Form.Control.Feedback type="invalid">{formErrors.montant_modifie}</Form.Control.Feedback>
                                </InputGroup>
                            </Col>
                        </Form.Group>
                    )}

                    {/* Nouvelle Date Fin */}
                    {formData.type_modification?.value === 'durée' && (
                        <Form.Group as={Row} className="mb-3 align-items-center" controlId="formNouvelle_date_fin">
                           <Form.Label column sm={3} className="small fw-medium text-sm-end">Nouvelle Date Fin <span className="text-danger">*</span></Form.Label>
                            <Col sm={9}>
                                <Form.Control
                                    className="p-2 rounded-pill shadow-sm bg-white border-1"
                                    isInvalid={!!formErrors.nouvelle_date_fin}
                                    required
                                    type="date"
                                    name="nouvelle_date_fin"
                                    value={formData.nouvelle_date_fin}
                                    onChange={handleChange}
                                    size="sm"
                                />
                                <Form.Control.Feedback type="invalid">{formErrors.nouvelle_date_fin}</Form.Control.Feedback>
                            </Col>
                         </Form.Group>
                    )}

                     {/* Partner Details Section (Conditional) */}
                     {formData.type_modification?.value === 'partenaire' && (
                         <Card className="mb-3 shadow-sm border-light">
                             <Card.Header className='bg-light py-2'><h6 className='mb-0 fw-semibold text-secondary'>Détails Modification Partenaires</h6></Card.Header>
                             <Card.Body className="pb-2 pt-3">
                                 {/* Partner Multi-Select Input */}
                                 <Form.Group as={Row} className="mb-3" controlId="formPartenaireSelectConditional">
                                     <Form.Label column sm={3} className="small pt-1 fw-medium text-sm-end"> Sélection Partenaires <span className="text-danger">*</span></Form.Label>
                                     <Col sm={9}>
                                         <Select
                                             inputId='avenant-partenaire-select-conditional'
                                             name="partenaireSelector"
                                             options={partenaireOptions}
                                             value={partenaireOptions.filter(opt => avenantPartnerDetails.some(p => p.id === opt.value))}
                                             onChange={handleAvenantPartnerSelectionChange}
                                             styles={selectStyles}
                                             placeholder="- Choisir partenaires concernés -"
                                             isMulti
                                             isClearable
                                             closeMenuOnSelect={false}
                                             isLoading={loadingOptions.partenaires}
                                             isInvalid={!!formErrors.partenaires} // Add isInvalid prop
                                             className={formErrors.partenaires ? 'is-invalid' : ''} // Keep class for visual cue
                                             classNamePrefix="react-select"
                                             menuPortalTarget={document.body}
                                             menuPlacement="auto"
                                         />
                                         {formErrors.partenaires && <div className="invalid-feedback d-block ps-1 small">{formErrors.partenaires}</div>}
                                     </Col>
                                 </Form.Group>

                                 {/* Render details section */}
                                 {avenantPartnerDetails.length > 0 && (
                                     <div className="mt-3 border-top pt-3">
                                         {avenantPartnerDetails.map((partner, index) => (
                                             <div key={partner.id} id={`formAvenantDetail_${partner.id}`} className={`mb-3 ${index < avenantPartnerDetails.length - 1 ? 'border-bottom pb-3' : ''}`}>
                                                 {/* Row for Partner Label, Montant, Signatory Switch */}
                                                 <Row className="mb-2 align-items-center px-sm-3">
                                                     <Col sm={12} md={4} className="small pt-1 fw-bold text-break">
                                                        <Form.Label className="mb-0">{partner.label}</Form.Label>
                                                     </Col>
                                                      {/* Montant Input */}
                                                      <Col sm={6} md={5} className="mt-2 mt-md-0">
                                                         <InputGroup size="sm" className="flex-nowrap">
                                                             <Form.Control
                                                                 type="number"
                                                                 step="0.01"
                                                                 min="0"
                                                                 value={partner.montant}
                                                                 onChange={(e) => handleAvenantCommitmentChange(partner.id, e.target.value)}
                                                                 placeholder="Montant" // Changed placeholder
                                                                 className="form-control-sm rounded-start-pill shadow-sm bg-white border-1" // Adjusted rounding
                                                                 isInvalid={!!formErrors[`montant_${partner.id}`]}
                                                              />
                                                             <InputGroup.Text className="rounded-end-pill">MAD</InputGroup.Text> {/* Adjusted rounding */}
                                                             <Form.Control.Feedback type="invalid" className="small w-100">{formErrors[`montant_${partner.id}`]}</Form.Control.Feedback>
                                                         </InputGroup>
                                                     </Col>
                                                     {/* Signatory Switch */}
                                                     <Col sm={6} md={3} className="d-flex justify-content-start justify-content-md-center align-items-center pt-2 pt-md-1">
                                                         <FormCheck
                                                            type="switch"
                                                            id={`avenant-signatory-check-${partner.id}`}
                                                            label="Signataire?"
                                                            checked={partner.is_signatory}
                                                            onChange={(e) => handleAvenantSignatoryChange(partner.id, e.target.checked)}
                                                            className="form-check-sm small"
                                                          />
                                                     </Col>
                                                 </Row>
                                                  {/* Conditional Row for Signatory Date & Details */}
                                                 {partner.is_signatory && (
                                                     <Row className="mt-1 mb-1 px-sm-3"> {/* Reduced mt */}
                                                         <Col md={4} className="d-none d-md-block"></Col> {/* Spacer */}
                                                         {/* Date Signature Input */}
                                                         <Col xs={12} sm={6} md={4} className="mb-2 mb-sm-0">
                                                             <Form.Group controlId={`formAvenantDateSig_${partner.id}`}>
                                                                 <Form.Label className="small mb-0 fw-medium text-muted">Date Signature</Form.Label>
                                                                 <Form.Control
                                                                      type="date"
                                                                      size="sm"
                                                                      value={partner.date_signature}
                                                                      onChange={(e) => handleAvenantSignatureDateChange(partner.id, e.target.value)}
                                                                      className="form-control-sm rounded-pill shadow-sm bg-white border-1"
                                                                      isInvalid={!!formErrors[`date_sig_${partner.id}`]}
                                                                   />
                                                                 <Form.Control.Feedback type="invalid" className="small">{formErrors[`date_sig_${partner.id}`]}</Form.Control.Feedback>
                                                             </Form.Group>
                                                         </Col>
                                                         {/* Details Signature Input */}
                                                         <Col xs={12} sm={6} md={4}>
                                                             <Form.Group controlId={`formAvenantDetailsSig_${partner.id}`}>
                                                                <Form.Label className="small mb-0 fw-medium text-muted">Détails Signature</Form.Label>
                                                                 <Form.Control
                                                                     type="text"
                                                                     size="sm"
                                                                     value={partner.details_signature}
                                                                     onChange={(e) => handleAvenantSignatureDetailsChange(partner.id, e.target.value)}
                                                                     placeholder="Lieu, obs..."
                                                                     className="form-control-sm rounded-pill shadow-sm bg-white border-1"
                                                                  />
                                                             </Form.Group>
                                                         </Col>
                                                     </Row>
                                                 )}
                                             </div>
                                         ))}
                                     </div>
                                 )}
                             </Card.Body>
                         </Card>
                     )}
                     {/* --- End Conditional Partner Section --- */}


                    {/* Remarques */}
                     <Form.Group as={Row} className="my-2" controlId="formRemarques">
                         <Form.Label column sm={2} className="small fw-medium text-sm-end">Remarques</Form.Label>
                         <Col sm={10}>
                            <Form.Control
                                className="p-3 rounded-5 shadow-sm  bg-white border-1"
                                as="textarea"
                                rows={2} name="remarques"
                                value={formData.remarques}
                                onChange={handleChange}
                                size="sm"
                                placeholder="Observations..."
                             />
                         </Col>
                    </Form.Group>

                    {/* --- Multi-File Upload Section --- */}
                    <Form.Group as={Row} className="my-2" controlId="avenantFileGroup">
                         <Form.Label column sm={2} className="small fw-medium text-sm-end">
                         Fichiers Joints   {/*  {(!isEditing || (isEditing && visibleExistingFichiers.length === 0 && fichiers.length === 0)) && <span className="text-danger">*</span>} */}
                         </Form.Label>
                         <Col sm={10}>
                             <Card className="border-dashed rounded-5">
                                 <Card.Body className='p-3'>
                                     <div className='mb-2'>
                                          <Button variant="outline-warning" size="sm" className="me-2 rounded-pill px-3" onClick={() => document.getElementById('avenant_fichiers_hidden_input')?.click()} >
                                               <FontAwesomeIcon icon={faPlus} className="me-1" /> Ajouter 
                                          </Button>
                                          <span className='small text-muted fst-italic'>Ajouter un ou plusieurs fichiers</span>
                                         <Form.Control
                                             id="avenant_fichiers_hidden_input"
                                             type="file"
                                             multiple
                                             onChange={handleFileChange}
                                             style={{ display: 'none' }}
                                             isInvalid={!!formErrors.fichiers || !!formErrors['fichiers.*']}
                                             accept=".pdf,.doc,.docx,image/*,.xls,.xlsx" />
                                         {(formErrors.fichiers || formErrors['fichiers.*']) && (
                                            <div className="d-block invalid-feedback small mt-1">
                                                {formErrors.fichiers || formErrors['fichiers.*']}
                                            </div>
                                          )}
                                     </div>
                                    {/* Display VISIBLE EXISTING files */}
                                    {isEditing && visibleExistingFichiers.length > 0 && (
                                        <div className='mt-2 pt-2 border-top'>
                                            <span className="me-2 small text-muted fw-bold">Fichiers Actuels:</span>
                                            <Stack direction="horizontal" gap={1} className="mt-1 flex-wrap" style={{fontSize: '0.85em'}}>
                                                {visibleExistingFichiers.map((file) => (
                                                    <Badge key={`existing-av-file-${file.id}`} pill bg='light' text='dark' className="d-flex border p-1 pe-2 align-items-center fw-normal shadow-sm">
                                                        <FontAwesomeIcon icon={faPaperclip} className='me-1 ms-1 text-secondary'/>
                                                        <span className='me-1 text-truncate' style={{maxWidth: '180px'}} title={file.file_name}>{file.file_name}</span>
                                                        {/* Don't show delete button if it's already marked */}
                                                        {!fichiersToDelete.includes(file.id) && (
                                                            <Button variant='link' size="sm" aria-label="Supprimer existant" className="p-0 m-0 ms-1 lh-1 text-danger" onClick={() => removeExistingFile(file.id)} title="Marquer pour suppression">
                                                                <FontAwesomeIcon icon={faTrashAlt} />
                                                            </Button>
                                                        )}
                                                    </Badge>
                                                ))}
                                            </Stack>
                                        </div>
                                     )}
                                     {/* Display files MARKED FOR DELETION (Optional visual cue) */}
                                     {isEditing && fichiersToDelete.length > 0 && existingFichiers.some(f => fichiersToDelete.includes(f.id)) && (
                                         <div className='mt-2 pt-2 border-top border-danger border-opacity-25'>
                                            <span className="me-2 small text-danger fw-bold">Fichiers Marqués pour Suppression:</span>
                                            <Stack direction="horizontal" gap={1} className="mt-1 flex-wrap" style={{fontSize: '0.85em'}}>
                                                {existingFichiers.filter(f => fichiersToDelete.includes(f.id)).map((file) => (
                                                     <Badge key={`deleted-av-file-${file.id}`} pill bg='danger' text='white' className="d-flex border p-1 pe-2 align-items-center fw-normal shadow-sm text-decoration-line-through">
                                                         <FontAwesomeIcon icon={faTrashAlt} className='me-1 ms-1'/>
                                                         <span className='me-1 text-truncate' style={{maxWidth: '180px'}} title={file.file_name}>{file.file_name}</span>
                                                         {/* Maybe an undo button here? Omitted for simplicity */}
                                                     </Badge>
                                                ))}
                                            </Stack>
                                         </div>
                                      )}
                                     {/* Display NEW files */}
                                     {fichiers.length > 0 && (
                                         <div className={`mt-2 pt-2 ${visibleExistingFichiers.length > 0 || fichiersToDelete.length > 0 ? 'border-top' : ''}`}>
                                            <span className="me-2 small text-muted fw-bold">Nouveaux Fichiers:</span>
                                            <Stack direction="horizontal" gap={1} className="mt-1 flex-wrap" style={{fontSize: '0.85em'}}>
                                                {fichiers.map((file, fileIndex) => (
                                                    <Badge key={`new-av-file-${file.name}-${fileIndex}`} pill bg="success" text="white" className="d-flex align-items-center fw-normal p-1 pe-2 shadow-sm">
                                                        <FontAwesomeIcon icon={faPaperclip} className='me-1 ms-1'/>
                                                        <span className='me-1 text-truncate' style={{maxWidth: '180px'}} title={file.name}>{file.name}</span>
                                                        <Button variant="close" size="sm" aria-label="Retirer nouveau" className="p-0 m-0 ms-1 lh-1 btn-close-white" onClick={() => removeNewFile(fileIndex)}></Button>
                                                    </Badge>
                                                ))}
                                            </Stack>
                                         </div>
                                     )}
                                     {/* Placeholder - Adjusted condition */}
                                     {fichiers.length === 0 && visibleExistingFichiers.length === 0 && (
                                         <div className="mt-2 pt-2 small text-muted fst-italic border-top">Aucun fichier joint.</div>
                                     )}
                                 </Card.Body>
                             </Card>
                         </Col>
                     </Form.Group>

                    {/* Action Buttons */}
                    <Row className="mt-4 pt-3 border-top justify-content-center">
                         <Col xs="auto"><Button variant="danger" onClick={onClose} className="btn px-5 rounded-pill shadow-sm" disabled={submissionStatus.loading}> Annuler </Button></Col>
                         <Col xs="auto"><Button type="submit" variant="primary" className="btn px-4 rounded-pill align-items-center d-flex justify-content-center shadow-sm" disabled={isSubmitDisabled}> {submissionStatus.loading ? ( <><Spinner as="span" animation="border" size="sm" className="me-2"/> Enreg...</> ) : (isEditing ? 'Enregistrer Modifs' : 'Ajouter Avenant')} </Button></Col>
                    </Row>
                </Form>
            </div>
        </div>
    );
};

// --- PropTypes ---
AvenantForm.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onClose: PropTypes.func.isRequired,
    onItemCreated: PropTypes.func,
    onItemUpdated: PropTypes.func,
    initialConventionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    baseApiUrl: PropTypes.string,
};

// --- Default Props ---
AvenantForm.defaultProps = {
    itemId: null,
    initialConventionId: null,
    onItemCreated: (createdItem) => console.log('Avenant Created:', createdItem),
    onItemUpdated: (updatedItem) => console.log('Avenant Updated:', updatedItem),
    baseApiUrl: 'http://192.168.30.241:81/api', // Ensure this matches your API base URL
};

export default AvenantForm;