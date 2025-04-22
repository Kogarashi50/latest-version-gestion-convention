// src/gestion_conventions/marches_publics_views/MarchePublicForm.jsx

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios'; // Use your configured instance
import { Form, Button, Row, Col, Spinner, Alert, Card, Stack, Badge , FormSelect} from 'react-bootstrap';
import Select from 'react-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrashAlt, faPaperclip } from '@fortawesome/free-solid-svg-icons';
// --- Constants ---
const TYPE_OPTIONS = [
    { value: 'Travaux', label: 'Travaux' },
    { value: 'Fournitures', label: 'Fournitures' },
    { value: 'Services', label: 'Services' },
    { value: 'Etudes', label: 'Etudes' }

];
const MODE_PASSATION_OPTIONS = [
    { value: "Appel d’offres ouvert", label: "Appel d’offres ouvert"},
    { value: "Appel d’offres restreint", label: "Appel d’offres restreint"},
    { value: "Marché négocié avec mise en concurrence", label: "Marché négocié avec mise en concurrence"},
    { value: "Marché négocié sans mise en concurrence", label: "Marché négocié sans mise en concurrence"},
    { value: "Concours", label: "Concours"},
    { value: "Marché de gré à gré", label: "Marché de gré à gré"},
    { value: "Système d’acquisition dynamique", label: "Système d’acquisition dynamique"},
    { value: "Accord-cadre", label: "Accord-cadre"},
 
];

const STATUT_OPTIONS = [
    { value: 'En préparation', label: 'En préparation' },
    { value: 'En cours', label: 'En cours' },
    { value: 'Terminé', label: 'Terminé' },
    { value: 'Résilié', label: 'Résilié' }
];
// --- End Constants ---
const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
        // Assuming date comes from API as YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
        const datePart = dateString.split(' ')[0];
         if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            return datePart;
        }
    } catch (e) {
        console.error("Error formatting date for input:", dateString, e);
    }
    return ''; // Return empty if format is wrong
};
const MarchePublicForm = ({ itemId, onClose, onItemCreated, onItemUpdated, baseApiUrl }) => {
    const isEditMode = !!itemId;

    // --- State for Convention Dropdown ---
    const [conventionOptions, setConventionOptions] = useState([]);
    const [loadingConventionOptions, setLoadingConventionOptions] = useState(true);
    // State to hold the currently selected {value, label} object for the Convention Select component UI
    const [selectedConventionOption, setSelectedConventionOption] = useState(null);
    // --- End Convention State ---
    const [AoOptions, setAoOptions] = useState([]);
    const [loadingAoOptions, setLoadingAoOptions] = useState(true);
    // State to hold the currently selected {value, label} object for the Convention Select component UI
    const [selectedAoOption, setSelectedAoOption] = useState(null);
    // Initial state for a single lot
    const initialLotState = {
        id: null,
        numero_lot: '',
        objet: '',
        montant_attribue: '',
        attributaire: '',
        fichiers: [], // Holds NEW File objects for this specific lot
        existing_fichiers: [], // Holds info {id, nom_fichier} of existing files for this lot
        fichiers_to_delete: [] // Holds IDs of existing files for this lot marked for deletion
    };

    // Initial state for the entire form, including general files and id_convention
    const initialFormData = {
        // Marche Public Fields
        numero_marche: '',
        intitule: '',        // Marche's own intitule
        id_convention: null,
        ref_appelOffre: null, // Store the selected AppelOffre ID
        date_ouverture_plis: '',
        date_fin_ouverture: '',
        avancement_physique: '0', // Default to 0 or ''
        avancement_financier: '0', // Default to 0 or ''
        date_engagement_tresorerie: '', // Foreign key to the convention
        type_marche: null,
        procedure_passation: '',
        mode_passation:null,
        budget_previsionnel: '',
        montant_attribue: '',
        source_financement: '',
        attributaire: '', // Attributaire principal
        date_publication: '',
        date_limite_offres: '',
        date_notification: '',
        date_debut_execution: '',
        duree_marche: '',
        statut: STATUT_OPTIONS.find(opt => opt.value === 'En préparation') || null,
        // Lots Array
        lots: [], // Initialize as empty array
        // General (Market-Level) Files State
        general_fichiers: [],             // Holds NEW general File objects selected by user
        general_existing_fichiers: [],    // Holds info {id, nom_fichier} of existing general files
        general_fichiers_to_delete: [] // Holds IDs of existing general files marked for deletion
    };

    const [formData, setFormData] = useState(initialFormData);
    const [isLoading, setIsLoading] = useState(isEditMode); // Loading form data state
    const [error, setError] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});
    const [errors, setErrors] = useState({}); 

    const apiEndpoint = isEditMode
        ? `${baseApiUrl}/marches-publics/${itemId}`
        : `${baseApiUrl}/marches-publics`;

    // --- Effect to fetch Convention Options ---
    useEffect(() => {
        let isMounted = true;
        setLoadingConventionOptions(true);
        console.log("Fetching convention options for select...");
        // ****** IMPORTANT: Use the correct endpoint that returns the convention list ******
        // If your index endpoint returns the list under 'conventions' key:
        axios.get(`${baseApiUrl}/conventions`)
        // If you created the dedicated list endpoint:
        // axios.get(`${baseApiUrl}/conventions/list-for-select`)
            .then(response => {
                if (!isMounted) return;
                console.log("Raw convention response data:", response.data); // Log raw response

                // ****** ADAPT THIS based on your ACTUAL API response structure ******
                const conventionsList = response.data?.conventions || response.data || []; // Adjust if needed

                if (!Array.isArray(conventionsList)) {
                    console.error("Convention data received is not an array:", conventionsList);
                    throw new Error("Format de données de convention invalide reçu.");
                }

                // Map to { value: id, label: Intitule } format
                // ****** IMPORTANT: Check the exact field names (id, Intitule/intitule) in your response ******
                const formattedOptions = conventionsList.map(opt => {
                     if (!opt || opt.id === undefined || opt.Intitule === undefined ) { // Check required fields
                        console.warn("Skipping invalid convention option:", opt);
                        return null; // Skip invalid entries
                    }
                    return {
                        value: opt.id,
                        label: opt.Intitule // Assuming the label field is 'Intitule' (capital I)
                    };
                }).filter(opt => opt !== null); // Remove any null entries from mapping invalid data


                console.log("Fetched and formatted convention options:", formattedOptions);
                setConventionOptions(formattedOptions);
            })
            .catch(error => {
                if (!isMounted) return;
                console.error("Error fetching convention options:", error);
                setError(prev => prev ? `${prev}\nErreur chargement liste conventions.` : "Erreur chargement liste conventions.");
                setConventionOptions([]); // Set empty on error
            })
            .finally(() => {
                if (isMounted) setLoadingConventionOptions(false);
            });

        return () => { isMounted = false; }; // Cleanup
    }, [baseApiUrl]); // Runs once on mount
    useEffect(() => {
        let isMounted = true;
        setLoadingAoOptions(true);
        console.log("Fetching ao options for select...");
        // ****** IMPORTANT: Use the correct endpoint that returns the convention list ******
        // If your index endpoint returns the list under 'conventions' key:
        axios.get(`${baseApiUrl}/appel-offres`)
        // If you created the dedicated list endpoint:
        // axios.get(`${baseApiUrl}/conventions/list-for-select`)
            .then(response => {
                if (!isMounted) return;
                console.log("Raw ao response data:", response.data); // Log raw response

                // ****** ADAPT THIS based on your ACTUAL API response structure ******
                const aoList = response.data?.appel_offres || response.data || []; // Adjust if needed

                if (!Array.isArray(aoList)) {
                    console.error("ao data received is not an array:", aoList);
                    throw new Error("Format de données de ao invalide reçu.");
                }

                // Map to { value: id, label: Intitule } format
                // ****** IMPORTANT: Check the exact field names (id, Intitule/intitule) in your response ******
                const formattedOptions = aoList.map(opt => {
                     if (!opt || opt.id === undefined || opt.intitule === undefined ) { // Check required fields
                        console.warn("Skipping invalid ao option:", opt);
                        return null; // Skip invalid entries
                    }
                    return {
                        value: opt.id,
                        label: opt.intitule // Assuming the label field is 'Intitule' (capital I)
                    };
                }).filter(opt => opt !== null); // Remove any null entries from mapping invalid data


                console.log("Fetched and formatted ao options:", formattedOptions);
                setAoOptions(formattedOptions);
            })
            .catch(error => {
                if (!isMounted) return;
                console.error("Error fetching ao options:", error);
                setError(prev => prev ? `${prev}\nErreur chargement liste ao.` : "Erreur chargement liste ao..");
                setAoOptions([]); // Set empty on error
            })
            .finally(() => {
                if (isMounted) setLoadingAoOptions(false);
            });

        return () => { isMounted = false; }; // Cleanup
    }, [baseApiUrl]);
    // --- Effect to Fetch Marche Public Data (for Edit Mode) ---
    useEffect(() => {
        let isMounted = true;
        // Only run if in edit mode AND convention options have been loaded
        if (isEditMode && !loadingConventionOptions && !loadingAoOptions) {
            setIsLoading(true); // Main form data loading starts
            setError(null);
            setValidationErrors({});
            console.log(`Form: Fetching edit data for Marche ID: ${itemId}`);

            // Fetch Marche data, Lots, Files (Convention options already loaded)
            Promise.all([
                axios.get(apiEndpoint),
                axios.get(`${apiEndpoint}/lots`),
                axios.get(`${apiEndpoint}/fichiers`)
            ]).then(([marcheRes, lotsRes, filesRes]) => {
                 if (!isMounted) return;

                 const itemData = marcheRes.data?.marche_public || marcheRes.data || {};
                 console.log("Fetched Marche Public item data:", itemData);
                 const fetchedLots = lotsRes.data?.lots || lotsRes.data || [];
                 const allFetchedFiles = filesRes.data?.fichiers_joints || filesRes.data || [];

                 // Separate Lot Files and General Files
                 const lotFilesMap = {};
                 const generalFiles = [];
                 allFetchedFiles.forEach(f => {
                     if (f.lot_id) {
                         if (!lotFilesMap[f.lot_id]) lotFilesMap[f.lot_id] = [];
                         lotFilesMap[f.lot_id].push({ id: f.id, nom_fichier: f.nom_fichier });
                     } else if (f.marche_id) {
                         generalFiles.push({ id: f.id, nom_fichier: f.nom_fichier });
                     }
                 });

                 // Set the main form data state
                 setFormData(prev => ({
                     ...prev, // Keep potentially pre-set state like default status
                     numero_marche: itemData.numero_marche || '',
                     intitule: itemData.intitule || '', // Marche's own intitule
                     id_convention: itemData.id_convention || null,
                    //  ref_appelOffre: itemData.ref_appelOffre || '', // Use the foreign key ID
                     date_ouverture_plis: formatDateForInput(itemData.date_ouverture_plis),
                     date_fin_ouverture: formatDateForInput(itemData.date_fin_ouverture),
                     // Use ?? 0 to default null/undefined to 0, handle potential string '0.0' from DB
                     avancement_physique: itemData.avancement_physique ?? '0',
                     avancement_financier: itemData.avancement_financier ?? '0',
                     date_engagement_tresorerie: formatDateForInput(itemData.date_engagement_tresorerie), // Set the convention ID
                     // Find the matching object for react-select state from options
                     type_marche: TYPE_OPTIONS.find(opt => opt.value === itemData.type_marche) || null,
                     procedure_passation: itemData.procedure_passation || '',
                     mode_passation: MODE_PASSATION_OPTIONS.find(opt => opt.value === itemData.mode_passation) || null,
                     budget_previsionnel: itemData.budget_previsionnel || '',
                     montant_attribue: itemData.montant_attribue || '',
                     source_financement: itemData.source_financement || '',
                     attributaire: itemData.attributaire || '',
                     date_publication: itemData.date_publication ? itemData.date_publication.split(' ')[0] : '',
                     date_limite_offres: itemData.date_limite_offres ? itemData.date_limite_offres.split(' ')[0] : '',
                     date_notification: itemData.date_notification ? itemData.date_notification.split(' ')[0] : '',
                     date_debut_execution: itemData.date_debut_execution ? itemData.date_debut_execution.split(' ')[0] : '',
                     duree_marche: itemData.duree_marche || '',
                     // Find the matching object for react-select state from options
                     statut: STATUT_OPTIONS.find(opt => opt.value === itemData.statut) || null,
                     lots: fetchedLots.map(lot => ({
                         id: lot.id,
                         numero_lot: lot.numero_lot || '',
                         objet: lot.objet || '',
                         montant_attribue: lot.montant_attribue || '',
                         attributaire: lot.attributaire || '',
                         fichiers: [],
                         existing_fichiers: lotFilesMap[lot.id] || [],
                         fichiers_to_delete: []
                     })),
                     general_fichiers: [],
                     general_existing_fichiers: generalFiles,
                     general_fichiers_to_delete: []
                 }));

                 // Pre-select the convention option based on the fetched ID
                 // Ensure conventionOptions are available before finding
                 const matchedOption = conventionOptions.find(opt => opt.value === itemData.id_convention);
                 if (matchedOption) {
                     console.log("Pre-selecting convention option by ID:", matchedOption);
                     setSelectedConventionOption(matchedOption);
                 } else if (itemData.id_convention) {
                     console.warn(`Could not find matching convention option for ID: "${itemData.id_convention}"`);
                     setSelectedConventionOption(null); // Reset if not found
                 } else {
                     setSelectedConventionOption(null); // No convention linked
                 }
                 const matchedOption2 =AoOptions.find(opt => opt.value === itemData.ref_appelOffre);
                 if (matchedOption2) {
                     console.log("Pre-selecting ao option by ID:", matchedOption2);
                     setSelectedAoOption(matchedOption2);
                 } else if (itemData.ref_appelOffre) {
                     console.warn(`Could not find matching ao option for ID: "${itemData.ref_appelOffre}"`);
                     setSelectedAoOption(null); // Reset if not found
                 } else {
                     setSelectedAoOption(null); // No convention linked
                 }

            })
            .catch(err => {
                 if (!isMounted) return;
                 console.error("Error fetching Marche Public data for edit:", err);
                 setError(err.response?.data?.message || err.message || "Erreur de chargement des données du marché.");
                 setFormData(initialFormData); // Reset form on error
                 setSelectedConventionOption(null);
                 setSelectedAoOption(null);

            })
            .finally(() => {
                if (isMounted) setIsLoading(false); // Stop main form loading
            });

        } else if (!isEditMode) {
             // Reset form for create mode
             setFormData(initialFormData);
             setSelectedConventionOption(null);
             setSelectedAoOption(null);

             setIsLoading(false); // Not loading in create mode initially
        }
        // If isEditMode but options were still loading, this effect will re-run when loadingConventionOptions becomes false.

        return () => { isMounted = false; }; // Cleanup
    // Dependency array: Run when item changes, mode changes, OR when convention options finish loading
    }, [itemId, isEditMode, apiEndpoint, loadingAoOptions, AoOptions,loadingConventionOptions, conventionOptions]);

  

    // --- Standard Input Handlers ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear validation error for the specific field
        if (validationErrors[name]) {
            setValidationErrors(prev => { const next = {...prev}; delete next[name]; return next; });
        }
    };

    // --- Specific Handler for other react-select components (like Type, Statut) ---
    const handleReactSelectChange = (selectedOption, actionMeta) => {
         const { name } = actionMeta; // Get the name prop from the Select component
         // Store the whole {value, label} object in formData for these selects
         setFormData(prev => ({ ...prev, [name]: selectedOption }));
         // Clear validation error for the specific field name
         if (validationErrors[name]) {
             setValidationErrors(prev => { const next = {...prev}; delete next[name]; return next; });
         }
    };
    const handleAoSelectChange = (selectedOption) => {
        console.log("ao selected:", selectedOption);
        setSelectedAoOption(selectedOption); // Update the state for the Select component UI

        // Update formData with the selected convention's ID
        setFormData(prev => ({
            ...prev,
            ref_appelOffre: selectedOption ? selectedOption.value : null // Store the value (the ID)
        }));

        // Clear validation error for 'ref_appelOffre'
        if (validationErrors.ref_appelOffre) {
             setValidationErrors(prev => {
                 const next = {...prev};
                 delete next.ref_appelOffre;
                 return next;
             });
         }
    };
    // --- Handler for Convention Select Change ---
    const handleConventionSelectChange = (selectedOption) => {
        console.log("Convention selected:", selectedOption);
        setSelectedConventionOption(selectedOption); // Update the state for the Select component UI

        // Update formData with the selected convention's ID
        setFormData(prev => ({
            ...prev,
            id_convention: selectedOption ? selectedOption.value : null // Store the value (the ID)
        }));

        // Clear validation error for 'id_convention'
        if (validationErrors.id_convention) {
             setValidationErrors(prev => {
                 const next = {...prev};
                 delete next.id_convention;
                 return next;
             });
         }
    };
    // --- END Convention Handler ---


    // --- Lot Handlers ---
    const handleLotChange = useCallback((index, e) => {
        const { name, value } = e.target;
        // Ensure formData.lots exists before mapping
        const updatedLots = (formData.lots || []).map((lot, i) => i === index ? { ...lot, [name]: value } : lot);
        setFormData(prev => ({ ...prev, lots: updatedLots }));
        const errorKey = `lots.${index}.${name}`;
        if (validationErrors[errorKey]) {
             setValidationErrors(prev => { const next = {...prev}; delete next[errorKey]; return next; });
        }
    }, [formData.lots, validationErrors]);

    const handleLotFileChange = useCallback((index, e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        // Ensure formData.lots exists
        const updatedLots = (formData.lots || []).map((lot, i) => i === index ? { ...lot, fichiers: [...(lot.fichiers || []), ...files] } : lot);
        setFormData(prev => ({ ...prev, lots: updatedLots }));
        e.target.value = null; // Reset file input
        const errorKeyBaseExact = `lot_files.${index}`;
        const errorKeyBaseWildcard = `lot_files.${index}.*`;
         if (validationErrors[errorKeyBaseExact] || validationErrors[errorKeyBaseWildcard]) {
            setValidationErrors(prev => {
                 const next = {...prev};
                 delete next[errorKeyBaseExact];
                 delete next[errorKeyBaseWildcard];
                 return next;
            });
         }
    }, [formData.lots, validationErrors]);

    const removeNewLotFile = useCallback((lotIndex, fileIndex) => {
        // Ensure formData.lots exists
        const updatedLots = (formData.lots || []).map((lot, i) => {
            if (i === lotIndex) {
                const currentFiles = lot.fichiers || [];
                return { ...lot, fichiers: currentFiles.filter((_, fIdx) => fIdx !== fileIndex) };
            }
            return lot;
        });
        setFormData(prev => ({ ...prev, lots: updatedLots }));
    }, [formData.lots]);

    const removeExistingLotFile = useCallback((lotIndex, fileId) => {
        if (!window.confirm("Supprimer ce fichier de lot existant ? Il sera effacé lors de la sauvegarde.")) return;
        // Ensure formData.lots exists
        const updatedLots = (formData.lots || []).map((lot, i) => {
            if (i === lotIndex) {
                return {
                    ...lot,
                    existing_fichiers: (lot.existing_fichiers || []).filter(f => f.id !== fileId),
                    fichiers_to_delete: [...(lot.fichiers_to_delete || []), fileId]
                };
            }
            return lot;
        });
        setFormData(prev => ({ ...prev, lots: updatedLots }));
    }, [formData.lots]);

    const addLot = useCallback(() => {
        // Ensure formData.lots exists before spreading
        setFormData(prev => ({ ...prev, lots: [...(prev.lots || []), { ...initialLotState }] }));
    }, []);

    const removeLot = useCallback((index) => {
        const lotNum = formData.lots?.[index]?.numero_lot || `(Lot ${index + 1})`;
        if (window.confirm(`Supprimer ${lotNum} et tous ses fichiers associés ?`)) {
             setFormData(prev => ({
                 ...prev,
                 lots: (prev.lots || []).filter((_, i) => i !== index)
             }));
             // Update validation errors (logic omitted for brevity, assuming it works)
             setValidationErrors(prevErrors => {
                const nextErrors = { ...prevErrors };
                // ... (logic to remove/shift errors) ...
                return nextErrors;
             });
        }
    }, [formData.lots]);
    // --- End Lot Handlers ---


    // --- General File Handlers ---
    const handleGeneralFileChange = useCallback((e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setFormData(prev => ({ ...prev, general_fichiers: [...(prev.general_fichiers || []), ...files] }));
        e.target.value = null; // Reset file input
        const errorKey = 'general_files.*';
        if (validationErrors[errorKey]) {
             setValidationErrors(prev => { const next = {...prev}; delete next[errorKey]; return next; });
         }
    }, [validationErrors]);

    const removeNewGeneralFile = useCallback((fileIndex) => {
        setFormData(prev => ({
            ...prev,
            general_fichiers: (prev.general_fichiers || []).filter((_, fIdx) => fIdx !== fileIndex)
        }));
    }, []);

    const removeExistingGeneralFile = useCallback((fileId) => {
        if (!window.confirm("Supprimer ce fichier général existant ? Il sera effacé lors de la sauvegarde.")) return;
        setFormData(prev => ({
            ...prev,
            general_existing_fichiers: (prev.general_existing_fichiers || []).filter(f => f.id !== fileId),
            general_fichiers_to_delete: [...(prev.general_fichiers_to_delete || []), fileId]
        }));
    }, []);
    // --- End General File Handlers ---


    // --- Server Error Mapping ---
    const mapServerErrors = useCallback((serverErrors) => {
        const formErrors = {};
        if (!serverErrors || typeof serverErrors !== 'object') return formErrors;
        for (const key in serverErrors) {
            const messages = Array.isArray(serverErrors[key]) ? serverErrors[key] : [serverErrors[key]];
            const lotFieldMatch = key.match(/^lots\.(\d+)\.(.+)$/);
            const lotFileMatch = key.match(/^lot_files\.(\d+)(?:\.(\d+|\*))?$/);
            const generalFileMatch = key.match(/^general_files(?:\.(\d+|\*))?$/);

            if (lotFieldMatch) {
                formErrors[`lots.${lotFieldMatch[1]}.${lotFieldMatch[2]}`] = messages;
            } else if (lotFileMatch) {
                 formErrors[`lot_files.${lotFileMatch[1]}.*`] = messages; // Use wildcard key
            } else if (generalFileMatch) {
                formErrors['general_files.*'] = messages; // Use wildcard key
            } else {
                formErrors[key] = messages; // Direct mapping for other fields (like id_convention, intitule)
            }
        }
        console.log("Mapped validation errors:", formErrors);
        return formErrors;
     }, []);


    // --- Form Submission ---
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        // Prevent submission if options are still loading
        if (loadingConventionOptions && !isEditMode) { // Allow edit even if options failed, just won't pre-select
            console.warn("Attempted submission while convention options were loading.");
             setError("Veuillez patienter pendant le chargement des options de convention.");
            return;
        }
        setIsLoading(true); setError(null); setValidationErrors({});
        console.log("Form Data Before Submit:", JSON.stringify(formData, null, 2));

        const submissionPayload = new FormData();

        // Append Marche Public Data (including id_convention)
        Object.entries(formData).forEach(([key, value]) => {
             if (key === 'lots' || key === 'general_fichiers' || key === 'general_existing_fichiers' || key === 'general_fichiers_to_delete') return;

             // Handle react-select objects stored in state (like type_marche, statut)
             if ((key === 'type_marche' ||key==='mode_passation'|| key === 'statut') && typeof value === 'object' && value !== null && value.value !== undefined) {
                 submissionPayload.append(key, value.value);
             }
             // Append other fields (id_convention is now a simple value or null)
             else if (value !== null && value !== undefined) {
                 submissionPayload.append(key, value);
             }
              // Sending null/undefined is fine, backend validation handles 'nullable'
         });

        // Append Lots Data as JSON
        const lotsJsonData = (formData.lots || []).map(lot => ({
            id: lot.id || null,
            numero_lot: lot.numero_lot || null,
            objet: lot.objet || null,
            montant_attribue: (lot.montant_attribue !== '' && !isNaN(Number(lot.montant_attribue))) ? parseFloat(lot.montant_attribue) : null,
            attributaire: lot.attributaire || null,
            fichiers_to_delete: lot.fichiers_to_delete || [],
        }));
        if (lotsJsonData.length > 0) {
            const lotsDataString = JSON.stringify(lotsJsonData);
            submissionPayload.append('lots_data', lotsDataString);
        } // No need to append if empty, backend validation handles 'nullable'

        // Append NEW Lot Files
        (formData.lots || []).forEach((lot, index) => {
             if (lot.fichiers && lot.fichiers.length > 0) {
                 lot.fichiers.forEach((file) => {
                     if (file instanceof File) {
                        submissionPayload.append(`lot_files[${index}][]`, file, file.name);
                     }
                 });
             }
        });

        // Append NEW General Files
        if (formData.general_fichiers && formData.general_fichiers.length > 0) {
            formData.general_fichiers.forEach((file) => {
                if (file instanceof File) {
                    submissionPayload.append(`general_files[]`, file, file.name);
                }
            });
        }

        // Append General Files to Delete IDs
        if (formData.general_fichiers_to_delete && formData.general_fichiers_to_delete.length > 0) {
            submissionPayload.append('general_fichiers_to_delete_ids', JSON.stringify(formData.general_fichiers_to_delete));
        }

        // Add PUT method for updates
        if (isEditMode) { submissionPayload.append('_method', 'PUT'); }

        console.log("Submitting FormData...");

        try {
            const config = { headers: { 'Accept': 'application/json', 'Content-Type': 'multipart/form-data' } };
            const method = isEditMode ? 'post' : 'post';
            const url = apiEndpoint;

            const response = await axios[method](url, submissionPayload, config);

            console.log(`API Response (${isEditMode ? 'Update' : 'Create'}):`, response.data);
            setError(null); setValidationErrors({});
            if (isEditMode && onItemUpdated) onItemUpdated(response.data.marche_public || response.data);
            else if (!isEditMode && onItemCreated) onItemCreated(response.data.marche_public || response.data);
            onClose();

        } catch (err) {
             console.error("Error submitting form:", err.response || err);
             const message = err.response?.data?.message || err.message || "Erreur de soumission.";
             if (err.response && err.response.status === 422) {
                 const serverErrors = err.response.data.errors || {};
                 console.error("Validation Errors from Server:", serverErrors);
                 setValidationErrors(mapServerErrors(serverErrors)); // Use the mapping function
                 setError("Veuillez corriger les erreurs.");
             } else {
                setError(message);
                setValidationErrors({});
             }
        } finally {
            setIsLoading(false);
        }
    }, [formData, isEditMode, apiEndpoint, onItemUpdated, onItemCreated, onClose, baseApiUrl, loadingAoOptions,loadingConventionOptions, mapServerErrors]);


    // --- Render ---
    // Determine overall loading state for disabling submit button etc.
    const isOverallLoading = (isLoading && isEditMode) || loadingConventionOptions ||loadingAoOptions;

    // Show full screen spinner only when loading initial MARCHE data in edit mode
    if (isLoading && isEditMode) {
        return <div className="text-center p-5"><Spinner animation="border" /> Chargement des données du marché...</div>;
    }

     // --- Main Form Render ---
     return (
        <Form onSubmit={handleSubmit} noValidate className='px-5 py-5'  style={{
            maxHeight: 'calc(90vh - 100px)', // Or adjust as needed for modal context
            overflowY: 'auto', // Enable vertical scrolling HERE
        }}>
            {/* Error Alerts */}
            {error && !Object.keys(validationErrors).length && <Alert variant="danger" className="mt-3">{error}</Alert>}
            {Object.keys(validationErrors).length > 0 && <Alert variant="warning" className="mt-3 small py-2">Veuillez corriger les erreurs indiquées ci-dessous.</Alert>}

            {/* --- Header --- */}
            <div className="d-flex justify-content-between align-items-center mb-4 flex-shrink-0">
                 <div>
                     <h5 className="text-uppercase fw-bold text-secondary mb-1">{isEditMode ? 'Modifier le' : 'Créer un nouveau'}</h5>
                     <h2 className="mb-0 fw-bold">Marché Public {isEditMode ? `(${formData.numero_marche || '...'})` : ''}</h2>
                 </div>
                 <Button variant="light" className='btn rounded-5 px-5 py-2 bg-warning shadow-sm' onClick={onClose} size="sm" title="Retour">
                      <b>Revenir a la liste</b>
                 </Button>
             </div>

            {/* --- Marche Public Fields --- */}
            <h5 className="mb-3 mt-2">Informations Générales</h5>
            <Row>
                {/* Numero Marche */}
                <Form.Group as={Col} md={isEditMode ? "6" : "12"} className="mb-3">
                    <Form.Label htmlFor="numero_marche">Numéro Marché <span className="text-danger">*</span></Form.Label>
                    <Form.Control id="numero_marche" className='form-control-style shadow-sm form-control-rounded' type="text" name="numero_marche" value={formData.numero_marche || ''} onChange={handleChange} isInvalid={!!validationErrors.numero_marche} />
                    <Form.Control.Feedback type="invalid">{validationErrors.numero_marche?.[0]}</Form.Control.Feedback>
                </Form.Group>
                {/* Statut (Edit Mode Only) */}
                 {isEditMode && (
                    <Form.Group as={Col} md="6" className="mb-3">
                        <Form.Label htmlFor="statut_select">Statut</Form.Label>
                        <Select
                        
                             id="statut_select"
                             name="statut" // Matches formData key
                             options={STATUT_OPTIONS}
                             value={formData.statut} // Assumes formData.statut holds the {value, label} object
                             onChange={handleReactSelectChange} // Use generic handler
                             styles={{ control: base => ({ ...base, borderColor: validationErrors.statut ? '#dc3545' : '#999797',
                                 borderRadius:'50px',
                            backgroundColor:'#f8f9fa',
                          
                              }) }}
                             placeholder="Sélectionner statut..."
                         />
                        {validationErrors.statut && <div className="d-block invalid-feedback">{validationErrors.statut[0]}</div>}
                    </Form.Group>
                 )}
            </Row>


             {/* Marche Public's Own Intitule */}
             <Form.Group className="mb-3">
                <Form.Label htmlFor="intitule">Intitulé du Marché <span className="text-danger">*</span></Form.Label>
                <Form.Control id="intitule" className='form-control-style shadow-sm form-control-rounded' as="textarea" rows={1} name="intitule" value={formData.intitule || ''} onChange={handleChange} isInvalid={!!validationErrors.intitule} placeholder="Objet spécifique du marché public..." />
                <Form.Control.Feedback type="invalid">{validationErrors.intitule?.[0]}</Form.Control.Feedback>
            </Form.Group>

             {/* *** Convention Select Field *** */}
             <Form.Group className="mb-3">
                 <Form.Label htmlFor="convention_select">Convention Associée</Form.Label>
                 <Select
                 
                     id="convention_select"
                     name="convention_select" // Internal name for the component
                     options={conventionOptions}
                     value={selectedConventionOption} // Controlled by its specific UI state
                     onChange={handleConventionSelectChange} // Specific handler
                     isLoading={loadingConventionOptions} // Show loading indicator
                     isDisabled={loadingConventionOptions} // Disable while loading options
                     placeholder={loadingConventionOptions ? "Chargement..." : "Sélectionner une convention (Optionnel)..."}
                     isClearable
                     noOptionsMessage={() => 'Aucune convention trouvée'}
                     loadingMessage={() => 'Chargement...'}
                     styles={{
                         control: (baseStyles) => ({
                             ...baseStyles,
                             borderColor: validationErrors.id_convention ? '#dc3545' : baseStyles.borderColor, 
                             borderRadius:'50px',
                             backgroundColor:'#f8f9fa',
                             // Check error using the actual data key
                         }),
                     }}
                 />
                 {/* Display validation errors for 'id_convention' */}
                 {validationErrors.id_convention && <div className="d-block invalid-feedback">{validationErrors.id_convention[0]}</div>}
             </Form.Group>

            {/* Type, Procedure, Mode */}
            <Row>
                 <Form.Group as={Col} md="4" className="mb-3">
                    <Form.Label htmlFor="type_marche_select">Type <span className="text-danger">*</span></Form.Label>
                     <Select
                         id="type_marche_select"
                         name="type_marche" // Matches formData key
                         options={TYPE_OPTIONS}
                         value={formData.type_marche} // Assumes formData.type_marche holds {value, label}
                         onChange={handleReactSelectChange} // Use generic handler
                         styles={{ control: base => ({ ...base, borderColor: validationErrors.type_marche ? '#dc3545' : base.borderColor,
                            borderRadius:'50px',
                            backgroundColor:'#f8f9fa'
                         }) }}
                         placeholder="Sélectionner type..."
                     />
                     {validationErrors.type_marche && <div className="d-block invalid-feedback">{validationErrors.type_marche?.[0]}</div>}
                 </Form.Group>
                 <Form.Group as={Col} md="4" className="mb-3">
                     <Form.Label htmlFor="procedure_passation">Procédure Passation</Form.Label>
                     <Form.Control id="procedure_passation" className='form-control-style shadow-sm form-control-rounded' type="text" name="procedure_passation" value={formData.procedure_passation || ''} onChange={handleChange} isInvalid={!!validationErrors.procedure_passation} />
                     <Form.Control.Feedback type="invalid">{validationErrors.procedure_passation?.[0]}</Form.Control.Feedback>
                 </Form.Group>
                 <Form.Group as={Col} md="4" className="mb-3">
                    <Form.Label htmlFor="mode_passation">Mode Passation</Form.Label>
                    <Select
                        id="mode_passation_select"
                        className='form-control-style shadow-sm form-control-rounded' // Use consistent style
                        name="mode_passation"
                        options={MODE_PASSATION_OPTIONS}
                        value={formData.mode_passation} // Bind to state
                        onChange={handleReactSelectChange} // Use standard handler
                        isInvalid={!!validationErrors.mode_passation}
                        styles={{ control: base => ({ ...base, borderColor: validationErrors.mode_passation ? '#dc3545' : base.borderColor,
                            borderRadius:'50px',
                            backgroundColor:'#f8f9fa'
                         }) }}
                         placeholder="Sélectionner mode..."

                         // Optional: match other controls
                    />
                       
                    {validationErrors.mode_passation && <div className="d-block invalid-feedback">{validationErrors.mode_passation?.[0]}</div>}
                    </Form.Group>
            </Row>
<Row className="mb-3">
                {/* Appel d'Offre Reference */}
                <Form.Group as={Col} md="6" controlId="ref_appelOffre">
                    <Form.Label>Appel d'Offre Associé </Form.Label>
           
                    <Select
                             id="ref_appelOffre"
                             name="ref_appelOffre" // Matches formData key
                             options={AoOptions}
                             value={selectedAoOption} // Assumes formData.statut holds {value, label}
                             onChange={handleAoSelectChange} // Use generic handler
                             styles={{ control: base => ({ ...base, borderColor: validationErrors.statut ? '#dc3545' : base.borderColor,
                                      borderRadius:'50px',
                            backgroundColor:'#f8f9fa'
                              }) }}
                              isLoading={loadingAoOptions} // Show loading indicator
                              isDisabled={loadingAoOptions} // Disable while loading options
                              placeholder={loadingAoOptions ? "Chargement..." : "Sélectionner un appel d\'offre (Optionnel)..."}
                              isClearable
                              noOptionsMessage={() => 'Aucun appel d\'offre trouvé'}
                              loadingMessage={() => 'Chargement...'}
                         />
                         
                         {validationErrors.ref_appelOffre && <div className="d-block invalid-feedback">{validationErrors.ref_appelOffre[0]}</div>}
                </Form.Group>

                {/* Date Ouverture Plis */}
                <Form.Group as={Col} md="6" controlId="date_ouverture_plis">
                    <Form.Label>Date Ouverture des Plis </Form.Label>
                    <Form.Control
                     className='form-control-style shadow-sm form-control-rounded'
                        type="date"
                        name="date_ouverture_plis"
                        value={formData.date_ouverture_plis}
                        onChange={handleChange}
                        isInvalid={!!errors.date_ouverture_plis}
                    />
                    <Form.Control.Feedback type="invalid">{errors.date_ouverture_plis}</Form.Control.Feedback>
                </Form.Group>
            </Row>

            <Row className="mb-3">
                 {/* Date Fin Ouverture */}
                 <Form.Group as={Col} md="6" controlId="date_fin_ouverture">
                    <Form.Label>Date Fin Session Ouverture </Form.Label>
                    <Form.Control
                     className='form-control-style shadow-sm form-control-rounded'
                        type="date"
                        name="date_fin_ouverture"
                        value={formData.date_fin_ouverture}
                        onChange={handleChange}
                        isInvalid={!!errors.date_fin_ouverture}
                    />
                    <Form.Control.Feedback type="invalid">{errors.date_fin_ouverture}</Form.Control.Feedback>
                </Form.Group>

                 {/* Date Engagement Trésorerie */}
                 <Form.Group as={Col} md="6" controlId="date_engagement_tresorerie">
                    <Form.Label>Date Engagement Trésorerie </Form.Label>
                    <Form.Control
                     className='form-control-style shadow-sm form-control-rounded'
                        type="date"
                        name="date_engagement_tresorerie"
                        value={formData.date_engagement_tresorerie}
                        onChange={handleChange}
                        isInvalid={!!errors.date_engagement_tresorerie}
                    />
                    <Form.Control.Feedback type="invalid">{errors.date_engagement_tresorerie}</Form.Control.Feedback>
                </Form.Group>
            </Row>

             <Row className="mb-3">
                 {/* Avancement Physique */}
                 <Form.Group as={Col} md="6" controlId="avancement_physique">
                    <Form.Label>Avancement Physique (%) </Form.Label>
                    <Form.Control
                    className='form-control-style shadow-sm form-control-rounded'
                        type="number"
                        name="avancement_physique"
                        value={formData.avancement_physique}
                        onChange={handleChange}
                        isInvalid={!!errors.avancement_physique}
                     
                        min="0"
                        max="100"
                        step="0.01" // Allow decimals
                    />
                    <Form.Control.Feedback type="invalid">{errors.avancement_physique}</Form.Control.Feedback>
                </Form.Group>

                 {/* Avancement Financier */}
                 <Form.Group as={Col} md="6" controlId="avancement_financier">
                    <Form.Label>Avancement Financier (%) </Form.Label>
                    <Form.Control
                    className='form-control-style shadow-sm form-control-rounded'
                        type="number"
                        name="avancement_financier"
                        value={formData.avancement_financier}
                        onChange={handleChange}
                        isInvalid={!!errors.avancement_financier}
                     
                        min="0"
                        max="100"
                        step="0.01" // Allow decimals
                    />
                    <Form.Control.Feedback type="invalid">{errors.avancement_financier}</Form.Control.Feedback>
                </Form.Group>
            </Row>
            {/* Budget / Montant */}
             <Row>
                 <Form.Group as={Col} md="6" className="mb-3">
                     <Form.Label htmlFor="budget_previsionnel">Budget Prévisionnel (MAD)</Form.Label>
                     <Form.Control id="budget_previsionnel" className='form-control-style shadow-sm form-control-rounded' type="number" step="0.01" name="budget_previsionnel" value={formData.budget_previsionnel || ''} onChange={handleChange} isInvalid={!!validationErrors.budget_previsionnel} placeholder="0.00" />
                     <Form.Control.Feedback type="invalid">{validationErrors.budget_previsionnel?.[0]}</Form.Control.Feedback>
                 </Form.Group>
                 <Form.Group as={Col} md="6" className="mb-3">
                     <Form.Label htmlFor="montant_attribue">Montant Attribué (MAD)</Form.Label>
                     <Form.Control id="montant_attribue" className='form-control-style shadow-sm form-control-rounded' type="number" step="0.01" name="montant_attribue" value={formData.montant_attribue || ''} onChange={handleChange} isInvalid={!!validationErrors.montant_attribue} placeholder="0.00" />
                     <Form.Control.Feedback type="invalid">{validationErrors.montant_attribue?.[0]}</Form.Control.Feedback>
                 </Form.Group>
            </Row>

            {/* Source / Attributaire */}
             <Row>
                 <Form.Group as={Col} md="6" className="mb-3">
                     <Form.Label htmlFor="source_financement">Source Financement</Form.Label>
                     <Form.Control id="source_financement" className='form-control-style shadow-sm form-control-rounded' type="text" name="source_financement" value={formData.source_financement || ''} onChange={handleChange} isInvalid={!!validationErrors.source_financement} />
                     <Form.Control.Feedback type="invalid">{validationErrors.source_financement?.[0]}</Form.Control.Feedback>
                 </Form.Group>
                 <Form.Group as={Col} md="6" className="mb-3">
                    <Form.Label htmlFor="attributaire">Attributaire</Form.Label>
                    <Form.Control id="attributaire" className='form-control-style shadow-sm form-control-rounded' as="textarea" rows={1} name="attributaire" value={formData.attributaire || ''} onChange={handleChange} isInvalid={!!validationErrors.attributaire} placeholder="Nom(s)..."/>
                    <Form.Control.Feedback type="invalid">{validationErrors.attributaire?.[0]}</Form.Control.Feedback>
                </Form.Group>
             </Row>

             {/* Dates */}
            <Row>
                 <Form.Group as={Col} md="6" lg="3" className="mb-3">
                    <Form.Label htmlFor="date_publication">Date Publication</Form.Label>
                    <Form.Control id="date_publication" className='form-control-style shadow-sm form-control-rounded' type="date" name="date_publication" value={formData.date_publication || ''} onChange={handleChange} isInvalid={!!validationErrors.date_publication} />
                    <Form.Control.Feedback type="invalid">{validationErrors.date_publication?.[0]}</Form.Control.Feedback>
                 </Form.Group>
                 <Form.Group as={Col} md="6" lg="3" className="mb-3">
                    <Form.Label htmlFor="date_limite_offres">Date Limite Offres</Form.Label>
                    <Form.Control className='form-control-style shadow-sm form-control-rounded' id="date_limite_offres" type="date" name="date_limite_offres" value={formData.date_limite_offres || ''} onChange={handleChange} isInvalid={!!validationErrors.date_limite_offres} />
                    <Form.Control.Feedback type="invalid">{validationErrors.date_limite_offres?.[0]}</Form.Control.Feedback>
                 </Form.Group>
                 <Form.Group as={Col} md="6" lg="3" className="mb-3">
                     <Form.Label htmlFor="date_notification">Date Notification</Form.Label>
                     <Form.Control className='form-control-style shadow-sm form-control-rounded' id="date_notification" type="date" name="date_notification" value={formData.date_notification || ''} onChange={handleChange} isInvalid={!!validationErrors.date_notification} />
                     <Form.Control.Feedback type="invalid">{validationErrors.date_notification?.[0]}</Form.Control.Feedback>
                 </Form.Group>
                 <Form.Group as={Col} md="6" lg="3" className="mb-3">
                     <Form.Label htmlFor="date_debut_execution" >Date Début Exécution</Form.Label>
                     <Form.Control className='form-control-style shadow-sm form-control-rounded' id="date_debut_execution" type="date" name="date_debut_execution" value={formData.date_debut_execution || ''} onChange={handleChange} isInvalid={!!validationErrors.date_debut_execution} />
                     <Form.Control.Feedback type="invalid">{validationErrors.date_debut_execution?.[0]}</Form.Control.Feedback>
                 </Form.Group>
             </Row>

             {/* Duree / Statut (Create Mode) */}
            <Row>
                 <Form.Group as={Col} md="6" className="mb-3">
                     <Form.Label htmlFor="duree_marche">Durée (jours)</Form.Label>
                     <Form.Control className='form-control-style shadow-sm form-control-rounded' id="duree_marche" type="number" step="1" min="0" name="duree_marche" value={formData.duree_marche || ''} onChange={handleChange} isInvalid={!!validationErrors.duree_marche} placeholder="Nombre entier" />
                     <Form.Control.Feedback type="invalid">{validationErrors.duree_marche?.[0]}</Form.Control.Feedback>
                 </Form.Group>
                 {/* Statut (Create Mode Only) */}
                 {!isEditMode && (
                    <Form.Group as={Col} md="6" className="mb-3">
                        <Form.Label htmlFor="statut_create">Statut Initial</Form.Label>
                         <Select
                             id="statut_create"
                             name="statut" // Matches formData key
                             options={STATUT_OPTIONS}
                             value={formData.statut} // Assumes formData.statut holds {value, label}
                             onChange={handleReactSelectChange} // Use generic handler
                             styles={{ control: base => ({ ...base, borderColor: validationErrors.statut ? '#dc3545' : base.borderColor,
                                      borderRadius:'50px',
                            backgroundColor:'#f8f9fa'
                              }) }}
                             placeholder="Sélectionner statut..."
                         />
                        {validationErrors.statut && <div className="d-block invalid-feedback">{validationErrors.statut[0]}</div>}
                    </Form.Group>
                 )}
             </Row>
            {/* --- End Marche Public Fields --- */}


             {/* --- Lots Section --- */}
             <h5 className="mt-4 mb-3">Lots</h5>
             {(formData.lots || []).map((lot, index) => (
                 <Card key={`lot-card-${index}-${lot.id || `new-${index}`}`} className="mb-3 lot-card border shadow-sm">
                     <Card.Body className='p-3'>
                         {/* Lot Header */}
                         <Row className="align-items-center mb-2">
                             <Col><Card.Title className="h6 mb-0">Lot {index + 1} {lot.id ? `(ID: ${lot.id})` : '(Nouveau)'}</Card.Title></Col>
                             <Col xs="auto"> <Button variant="outline-danger" size="sm" onClick={() => removeLot(index)} title="Supprimer ce lot" className='py-0 px-1 border-1'> <FontAwesomeIcon icon={faTrashAlt} size="md"/> </Button> </Col>
                         </Row>
                         {/* Lot Fields */}
                         <Row>
                             <Form.Group as={Col} md="6" className="mb-2">
                                 <Form.Label htmlFor={`lot_${index}_numero`} className="small text-muted">Numéro Lot</Form.Label>
                                 <Form.Control className='form-control-style shadow-sm form-control-rounded' id={`lot_${index}_numero`} size="sm" type="text" name="numero_lot" value={lot.numero_lot || ''} onChange={(e) => handleLotChange(index, e)} isInvalid={!!validationErrors[`lots.${index}.numero_lot`]}/>
                                 <Form.Control.Feedback type="invalid">{validationErrors[`lots.${index}.numero_lot`]?.[0]}</Form.Control.Feedback>
                             </Form.Group>
                            <Form.Group as={Col} md="6" className="mb-2">
                                <Form.Label htmlFor={`lot_${index}_montant`} className="small text-muted">Montant Attribué (MAD)</Form.Label>
                                <Form.Control className='form-control-style shadow-sm form-control-rounded' id={`lot_${index}_montant`} size="sm" type="number" step="0.01" name="montant_attribue" value={lot.montant_attribue || ''} onChange={(e) => handleLotChange(index, e)} isInvalid={!!validationErrors[`lots.${index}.montant_attribue`]} placeholder="0.00"/>
                                <Form.Control.Feedback type="invalid">{validationErrors[`lots.${index}.montant_attribue`]?.[0]}</Form.Control.Feedback>
                            </Form.Group>
                         </Row>
                         <Form.Group className="mb-2">
                            <Form.Label htmlFor={`lot_${index}_objet`} className="small text-muted">Objet Lot</Form.Label>
                            <Form.Control className='form-control-style shadow-sm form-control-rounded' id={`lot_${index}_objet`} size="sm" as="textarea" rows={1} name="objet" value={lot.objet || ''} onChange={(e) => handleLotChange(index, e)} isInvalid={!!validationErrors[`lots.${index}.objet`]} />
                            <Form.Control.Feedback type="invalid">{validationErrors[`lots.${index}.objet`]?.[0]}</Form.Control.Feedback>
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label htmlFor={`lot_${index}_attributaire`} className="small text-muted">Attributaire(s) Lot</Form.Label>
                            <Form.Control className='form-control-style shadow-sm form-control-rounded' id={`lot_${index}_attributaire`} size="sm" type="text" name="attributaire" value={lot.attributaire || ''} onChange={(e) => handleLotChange(index, e)} isInvalid={!!validationErrors[`lots.${index}.attributaire`]} />
                             <Form.Control.Feedback type="invalid">{validationErrors[`lots.${index}.attributaire`]?.[0]}</Form.Control.Feedback>
                         </Form.Group>
                         {/* Lot File Handling */}
                         <Form.Group className="mt-3">
                             <Form.Label className="small mb-1 text-muted"> <FontAwesomeIcon icon={faPaperclip} className="me-1"/> Fichiers Joints (Lot)</Form.Label>
                             <Form.Control className='form-control-style shadow-sm form-control-rounded' id={`lot_${index}_fichiers_hidden_input`} type="file" multiple onChange={(e) => handleLotFileChange(index, e)} style={{ display: 'none' }} aria-hidden="true" isInvalid={!!validationErrors[`lot_files.${index}.*`]}/>
                             <Button  size="sm" className="d-inline-block ms-2 btn bg-light outline-primary text-primary rounded-5" onClick={() => document.getElementById(`lot_${index}_fichiers_hidden_input`)?.click()} > <FontAwesomeIcon icon={faPlus} className="me-1" /> Ajouter Fichier(s)</Button>
                             {validationErrors[`lot_files.${index}.*`] && ( <div className="d-block invalid-feedback small mt-1 ms-1">{validationErrors[`lot_files.${index}.*`]?.[0]}</div> )}
                             {/* Display EXISTING lot files */}
                             {isEditMode && lot.existing_fichiers?.length > 0 && ( <Stack direction="horizontal" gap={1} className="mt-2 flex-wrap" style={{fontSize: '0.8em'}}><span className="me-2 small text-muted">Existants:</span> {(lot.existing_fichiers || []).map((file) => ( <Badge key={`existing-lot-${index}-file-${file.id}`} pill bg="info" text="dark" className="d-flex p-2 align-items-center fw-normal"><span className='me-1 text-truncate' style={{maxWidth: '120px'}} title={file.nom_fichier}>{file.nom_fichier}</span><Button variant="close" size="sm" aria-label="Supprimer existant" className="p-0 ms-1" style={{fontSize: '0.6em'}} onClick={() => removeExistingLotFile(index, file.id)} title="Marquer pour suppression"></Button></Badge> ))} </Stack> )}
                             {/* Display selected NEW lot files */}
                             {lot.fichiers?.length > 0 && ( <Stack direction="horizontal" gap={1} className={`${(isEditMode && lot.existing_fichiers?.length > 0) ? 'mt-1' : 'mt-2'} flex-wrap`} style={{fontSize: '0.8em'}}><span className="me-2 small text-muted">Nouveaux:</span> {(lot.fichiers || []).map((file, fileIndex) => ( <Badge key={`new-lot-${index}-file-${file.name}-${fileIndex}-${Date.now()}`} pill bg="success" className="d-flex align-items-center fw-normal"><span className='me-1 p-2 text-truncate' style={{maxWidth: '120px'}} title={file.name}>{file.name}</span><Button variant="close" size="sm" aria-label="Retirer nouveau" className="btn-close-white p-0 ms-1" style={{fontSize: '1em', filter: 'invert(1) grayscale(100%) brightness(200%)'}} onClick={() => removeNewLotFile(index, fileIndex)}></Button></Badge> ))} </Stack> )}
                             {/* Placeholder if no lot files */}
                             {!lot.fichiers?.length && !lot.existing_fichiers?.length && ( <div className="mt-2 small text-muted fst-italic">Aucun fichier joint pour ce lot.</div> )}
                         </Form.Group>
                    </Card.Body>
                </Card>
            ))}
            {/* Add Lot Button */}
            <Button variant="outline-success" size="sm" onClick={addLot} className="rounded-5 d-flex align-items-center mb-3">
                 <FontAwesomeIcon icon={faPlus} className="me-2" /> Ajouter un Lot
            </Button>
            {/* --- End Lots Section --- */}


             {/* --- General Files Section --- */}
            <h5 className="mt-4 mb-3">Fichiers Généraux du Marché</h5>
            <Card className="mb-3 border shadow-sm">
                <Card.Body className='p-3'>
                    <Form.Group controlId="generalFileGroup">
                         <Form.Label className="small mb-1 text-muted">
                             <FontAwesomeIcon icon={faPaperclip} className="me-1"/> Joindre Fichiers Généraux
                         </Form.Label>
                         <Form.Control className='form-control-style shadow-sm form-control-rounded' id="general_fichiers_hidden_input" type="file" multiple onChange={handleGeneralFileChange} style={{ display: 'none' }} aria-hidden="true" isInvalid={!!validationErrors['general_files.*']} />
                         <Button variant="outline-info" size="sm" className="d-inline-block ms-2 rounded-5" onClick={() => document.getElementById('general_fichiers_hidden_input')?.click()} > <FontAwesomeIcon icon={faPlus} className="me-1" /> Ajouter Fichier(s) Général </Button>
                         {validationErrors['general_files.*'] && ( <div className="d-block invalid-feedback small mt-1 ms-1">{validationErrors['general_files.*'][0]}</div> )}
                         {/* Display EXISTING general files */}
                         {isEditMode && formData.general_existing_fichiers?.length > 0 && ( <Stack direction="horizontal" gap={1} className="mt-2 flex-wrap" style={{fontSize: '0.8em'}}> <span className="me-2 small text-muted">Existants:</span> {(formData.general_existing_fichiers || []).map((file) => ( <Badge key={`existing-general-file-${file.id}`} pill bg="info" text="dark" className="d-flex p-2 align-items-center fw-normal"> <span className='me-1 text-truncate' style={{maxWidth: '120px'}} title={file.nom_fichier}>{file.nom_fichier}</span><Button variant="close" size="sm" aria-label="Supprimer général existant" className="p-0 ms-1" style={{fontSize: '0.6em'}} onClick={() => removeExistingGeneralFile(file.id)} title="Marquer pour suppression"></Button> </Badge> ))} </Stack> )}
                         {/* Display NEW general files */}
                         {formData.general_fichiers?.length > 0 && ( <Stack direction="horizontal" gap={1} className={`${(isEditMode && formData.general_existing_fichiers?.length > 0) ? 'mt-2' : 'mt-2'} flex-wrap`} style={{fontSize: '0.8em'}}> <span className="me-2 small text-muted">Nouveaux:</span> {(formData.general_fichiers || []).map((file, fileIndex) => ( <Badge key={`new-general-file-${file.name}-${fileIndex}-${Date.now()}`} pill bg="success" className="d-flex align-items-center fw-normal"> <span className='me-1 text-truncate my-2 ' style={{maxWidth: '120px'}} title={file.name}>{file.name}</span><Button variant="close" size="sm" aria-label="Retirer nouveau général" className="btn-close-white p-0 ms-1" style={{fontSize: '1em', filter: 'invert(1) grayscale(100%) brightness(200%)'}} onClick={() => removeNewGeneralFile(fileIndex)}></Button> </Badge> ))} </Stack> )}
                         {/* Placeholder if no general files */}
                         {!formData.general_fichiers?.length && !formData.general_existing_fichiers?.length && ( <div className="mt-2 small text-muted fst-italic">Aucun fichier général joint.</div> )}
                    </Form.Group>
                </Card.Body>
            </Card>
             {/* --- END General Files Section --- */}


            {/* Submit/Cancel Buttons */}
            <div className="text-center mt-4 pt-3 border-top">
                 <Button variant="danger" onClick={onClose} className="me-2 rounded-5 px-5">Annuler</Button>
                 {/* Disable button if main form data is loading OR if convention options are loading */}
                 <Button variant="primary" type="submit" className="me-2 rounded-5 px-5" disabled={isOverallLoading}>
                    {isOverallLoading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/> : null}
                    {isOverallLoading ? 'Chargement...' : (isEditMode ? 'Enregistrer Modifications' : 'Créer Marché')}
                </Button>
            </div>
        </Form>
    );
};

// --- PropTypes ---
MarchePublicForm.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onClose: PropTypes.func.isRequired,
    onItemCreated: PropTypes.func,
    onItemUpdated: PropTypes.func,
    baseApiUrl: PropTypes.string.isRequired,
};

export default MarchePublicForm;