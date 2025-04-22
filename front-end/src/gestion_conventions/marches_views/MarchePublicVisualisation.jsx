
// src/gestion_conventions/marches_publics_views/MarchePublicVisualisation.jsx

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios'; // Needed for fetching data
import { Spinner, Alert, Table, Badge, Stack, Button, Row, Col } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFilePdf, faFileWord, faFileImage, faFileExcel, faFileAlt,
    faExternalLinkAlt,
    faTimes, faInfoCircle, faLink // Added link icon for convention
} from '@fortawesome/free-solid-svg-icons';
import './marche.css'
// --- Helpers ---
const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        const datePart = dateString.split(' ')[0];
        // Ensure valid date format before creating Date object
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
             throw new Error("Invalid date format expected YYYY-MM-DD");
        }
        return new Date(datePart + 'T00:00:00').toLocaleDateString('fr-CA'); // Add time to avoid timezone issues, format YYYY-MM-DD
     }
    catch (e) { console.error("Date format error:", dateString, e); return dateString; }
};
const formatCurrency = (value) => {
    if (value == null || value === '' || isNaN(Number(value))) return '-';
    try {
        return parseFloat(value).toLocaleString('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 });
    } catch (e) {
         console.error("Currency format error:", value, e);
         return String(value); // Return original value as string on error
    }
};
const STATUT_OPTIONS = [
    { value: 'En préparation', label: 'En préparation', color: 'secondary' },
    { value: 'En cours', label: 'En cours', color: 'primary' },
    { value: 'Terminé', label: 'Terminé', color: 'success' },
    { value: 'Résilié', label: 'Résilié', color: 'danger' }
];
const getStatusColor = (statusValue) => {
    const option = STATUT_OPTIONS.find(opt => opt.value === statusValue);
    return option ? option.color : "light";
};
const getFileIcon = (filenameOrMimeType) => {
    if (!filenameOrMimeType) return faFileAlt;
    const lowerCase = String(filenameOrMimeType).toLowerCase();
    if (lowerCase.includes('pdf')) return faFilePdf;
    if (lowerCase.includes('doc')) return faFileWord;
    if (lowerCase.includes('xls')) return faFileExcel;
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].some(ext => lowerCase.endsWith(ext)) || lowerCase.startsWith('image/')) return faFileImage;
    return faFileAlt; // Default icon
};
// --- End Helpers ---

const MarchePublicVisualisation = ({ itemId, onClose, baseApiUrl }) => {
    const [marcheData, setMarcheData] = useState(null);
    const [lotsData, setLotsData] = useState([]);
    const [filesData, setFilesData] = useState([]);
    const [conventionName, setConventionName] = useState(null); // <-- State for Convention Name
    const [loadingMarche, setLoadingMarche] = useState(true); // Loading state for Marche details
    const [loadingRelated, setLoadingRelated] = useState(true); // Loading state for Lots, Files, Convention
    const [error, setError] = useState(null);

    // Calculate Base Public URL for file links
    const publicBaseUrl = React.useMemo(() => {
        try {
            const url = new URL(baseApiUrl);
            if (url.pathname.endsWith('/api')) {
                 url.pathname = url.pathname.substring(0, url.pathname.length - 4);
            } else if (url.pathname.endsWith('/api/')) {
                 url.pathname = url.pathname.substring(0, url.pathname.length - 5);
            }
            return url.origin + url.pathname.replace(/\/$/, '');
        } catch (e) {
            console.error("Could not parse baseApiUrl to determine public base URL", baseApiUrl, e);
            return baseApiUrl.replace(/\/$/, '');
        }
    }, [baseApiUrl]);

    // Fetch all related data
    useEffect(() => {
        let isMounted = true;
        if (!itemId) {
            setLoadingMarche(false); setLoadingRelated(false);
            setError("ID du Marché manquant.");
            return;
        }

        const fetchDetails = async () => {
            setLoadingMarche(true); setLoadingRelated(true);
            setError(null); setMarcheData(null); setLotsData([]); setFilesData([]); setConventionName(null);
            console.log(`Visualisation: Fetching main details for Marche ID: ${itemId}`);

            try {
                // 1. Fetch Marche Public data first
                const marcheRes = await axios.get(`${baseApiUrl}/marches-publics/${itemId}`);
                if (!isMounted) return;

                const fetchedMarcheData = marcheRes.data?.marche_public || marcheRes.data || null;
                setMarcheData(fetchedMarcheData);
                setLoadingMarche(false); // Stop marche loading indicator

                if (!fetchedMarcheData) {
                    setError("Données principales du marché non trouvées.");
                    setLoadingRelated(false); // Stop related loading too if marche not found
                    return; // Stop further fetching if marche data is missing
                }

                console.log(`Visualisation: Fetched Marche data, ID Convention: ${fetchedMarcheData.id_convention}`);

                // 2. Prepare fetches for related data (Lots, Files, and potentially Convention)
                const relatedPromises = [
                    axios.get(`${baseApiUrl}/marches-publics/${itemId}/lots`),
                    axios.get(`${baseApiUrl}/marches-publics/${itemId}/fichiers`),
                ];

                // 3. Conditionally add Convention fetch if ID exists
                let conventionPromise = Promise.resolve(null); // Default to resolved null promise
                if (fetchedMarcheData.id_convention) {
                    console.log(`Visualisation: Preparing to fetch convention details for ID: ${fetchedMarcheData.id_convention}`);
                    // ****** IMPORTANT: Ensure this endpoint exists and returns convention details ******
                    conventionPromise = axios.get(`${baseApiUrl}/conventions/${fetchedMarcheData.id_convention}`)
                        .catch(convErr => {
                            // Handle convention fetch error gracefully - don't stop everything
                            console.error(`Error fetching convention details (ID: ${fetchedMarcheData.id_convention}):`, convErr.response || convErr);
                            if (isMounted) {
                                // Set a placeholder name indicating the error
                                setConventionName(`(Erreur chargement Conv. ID: ${fetchedMarcheData.id_convention})`);
                            }
                            return null; // Return null to allow Promise.all to continue
                        });
                }

                relatedPromises.push(conventionPromise); // Add the convention promise (or the resolved null)

                // 4. Fetch Lots, Files, and Convention in parallel
                const [lotsRes, filesRes, conventionResOrNull] = await Promise.all(relatedPromises);

                if (!isMounted) return; // Check again after awaits

                // 5. Set state for Lots and Files
                setLotsData(lotsRes.data?.lots || lotsRes.data || []);
                setFilesData(filesRes.data?.fichiers_joints || filesRes.data || []);

                // 6. Set state for Convention Name (if fetched successfully)
                if (conventionResOrNull && conventionResOrNull.data) {
                    // ****** IMPORTANT: Adjust field name ('Intitule') based on your API response ******
                    const name = conventionResOrNull.data?.convention?.Intitule || conventionResOrNull.data?.Intitule || null;
                    setConventionName(name);
                    console.log(`Visualisation: Set convention name: ${name}`);
                } else if (!fetchedMarcheData.id_convention) {
                    setConventionName(null); // Ensure it's null if no ID
                } // Error case already handled in the .catch of conventionPromise


            } catch (err) { // Catch errors from fetching Marche, Lots, or Files
                 if (!isMounted) return;
                console.error("Error fetching visualisation data (Marche/Lots/Files):", err.response || err);
                setError(err.response?.data?.message || err.message || "Erreur lors du chargement des détails.");
                 // Ensure loading is stopped even on error
                 setLoadingMarche(false);
            } finally {
                 if (isMounted) setLoadingRelated(false); // Stop related loading indicator
            }
        };

        fetchDetails();
        return () => { isMounted = false; }; // Cleanup function
    }, [itemId, baseApiUrl]); // Rerun if itemId or baseApiUrl changes

    // Helper to render detail fields
    const renderDetail = (label, value, formatter = null, mdSize , lgSize ) => (
         // Check for null, undefined, or empty string, but allow 0
         (value !== null && value !== undefined && value !== '') || value === 0 ?
            <Col xs={12} md={mdSize||12} lg={lgSize||12} className="mb-3 data-point text-center">
                <strong className="text-dark titly d-block label">{label} </strong>
                <span className="value">{formatter ? formatter(value) : value}</span>
            </Col>
        : null
    );
    const renderDetail2 = (label, value, formatter = null, mdSize , lgSize ) => (
        // Check for null, undefined, or empty string, but allow 0
        (value !== null && value !== undefined && value !== '') || value === 0 ?
           <Col xs={12} md={mdSize||12} lg={lgSize||12} className="mb-3 d-flex justify-content-between ">
               <strong className="text-dark titly fw-bold  d-block label">{label} : </strong>
               <span className="value">{formatter ? formatter(value) : value}</span>
           </Col>
       : null
   );

    // Generate Public URL for a file
    const getPublicFileUrl = (relativePath) => {
        if (!relativePath || !publicBaseUrl) return null;
        const storageUrl = `${publicBaseUrl}`;
        return `${storageUrl}/${relativePath.replace(/^\//, '')}`;
    };

    // Filter files and create map
    const marketFiles = filesData.filter(f => f.marche_id && !f.lot_id);
    const lotFilesMap = filesData.reduce((acc, f) => {
        if (f.lot_id) {
            if (!acc[f.lot_id]) acc[f.lot_id] = [];
            acc[f.lot_id].push(f);
        }
        return acc;
    }, {});

    // --- Render Logic ---
    const isLoading = loadingMarche || loadingRelated; // Overall loading state

    if (loadingMarche) { // Show initial loading spinner
       return <div className="text-center p-5"><Spinner animation="border" /><span> Chargement initial...</span></div>;
    }

    if (error) { return <Alert variant="danger" className="m-3">Erreur: {error}</Alert>; }
    if (!marcheData) { return <Alert variant="warning" className="m-3">Aucune donnée principale de marché trouvée.</Alert>; }
console.log('mode passation :',marcheData.mode_passation)
    // Main content render
    return (
        <div className='px-4'>
            {/* Header Section */}
             <div className="d-flex justify-content-between  align-items-start mb-4 px-5 pt-5 border-bottom holder pb-1">
                 <div>
                    <h2 className="mb-1 fw-bold text-dark ">Marché Public : {marcheData.numero_marche}
                    </h2>
                 </div>
                 {onClose && (
                     <Button variant="warning"  onClick={onClose} title="Fermer" className="px-5 border-0 rounded-5 shadow-sm ">
                         <b>Revenir a la liste</b>
                     </Button>
                 )}
             </div>
            <div className="px-5 pb-3 holder"> {/* Content Padding */}
                {/* Main Details */}
                <h5 className="mb-3 section-title text-uppercase fw-bold text-secondary">Informations Générales</h5>
                <Row className="mb-4 pb-3 border-bottom data-section">
                     {/* Intitule */}
                     <Col xs={12} className="mb-3 data-point text-dark text-center pill bg-white shadow-sm p-2 px-5 rounded-2 ">
                        <strong className=" titly fs-bold d-block label">Intitulé du Marché</strong>
                        <p className="value lead mb-0">{marcheData.intitule || '-'}</p>
                    </Col></Row>
                    <Row>
                    {/* Convention Associée */}
                    <Col xs={12} className="mb-3 data-point  "><Row className='p-4 m-2 bg-white shadow-sm rounded-5'>
                    {renderDetail(
                        "Convention Associée",
                        conventionName, // Display fetched name
                        (name) => name ? // Add link icon if name exists
                            <span><FontAwesomeIcon icon={faLink} className="me-2 text-warning"/>{name}</span> : '-',
                        3,3 // Take more space
                    )}
                    {renderDetail(
                                    "Appel d'Offre Réf.",
                                    // Access nested AO data safely
                                    marcheData.appel_offre?.numero,
                                    (num) => num ? <span><FontAwesomeIcon icon={faLink} className="me-2 text-warning"/>{num}</span> : '-',3,3
                                )}
                    {/* Other Details */}
                    {renderDetail("Type", marcheData.type_marche, null, 3,3)}
                    {renderDetail("Statut", marcheData.statut, (status) => {
                         const color = getStatusColor(status);
                         return <Badge bg={color} text={color === 'warning' || color === 'light' ? 'dark' : 'white'}>{status}</Badge>;
                     }, 3,3)}</Row></Col>
                     <Col xs={12} className="mb-3 data-point">
                     <div  className='d-flex w-100 justify-content-between '>
                     <div className=' p-3 m-2 bg-white rounded-5 shadow-sm w-100'>
                    {renderDetail2("Procédure Passation", marcheData.procedure_passation, null)}
                    {renderDetail2("Mode Passation", marcheData.mode_passation, null, )}
                    {renderDetail2("Budget Prévisionnel", marcheData.budget_previsionnel, formatCurrency, )}
                    {renderDetail2("Montant Attribué", marcheData.montant_attribue, formatCurrency, )}</div>
                    
                    <div className='p-4 m-2 bg-white rounded-5 shadow-sm w-100' >{renderDetail2("Source Financement", marcheData.source_financement, null)}
                    {renderDetail2("Attributaire(s) Principal", marcheData.attributaire, null, )}
                    {renderDetail2("Date Publication", marcheData.date_publication, formatDate)}
                    
                    {renderDetail2("Date Limite Offres", marcheData.date_limite_offres, formatDate)}</div>
                   
                    </div>
                    
                    </Col>
                </Row>
                <Row>
                    <Col xs={6}>
                <div className=' p-4 m-2 bg-white rounded-5 shadow-sm flex-fill w-100'> {/* Added flex-fill */}
                               
                                {renderDetail2("Date Ouverture Plis", marcheData.date_ouverture_plis, formatDate)}
                                {renderDetail2("Date Fin Session Ouverture", marcheData.date_fin_ouverture, formatDate)}
                                {renderDetail2(
                                     "Avancement Physique",
                                     marcheData.avancement_physique,
                                     // Format as percentage
                                     (val) => `${parseFloat(val || 0).toFixed(2)} %`
                                )}
                                {renderDetail2(
                                     "Avancement Financier",
                                     marcheData.avancement_financier,
                                     // Format as percentage
                                     (val) => `${parseFloat(val || 0).toFixed(2)} %`
                                 )}
                                {renderDetail2("Date Engagement Trésorerie", marcheData.date_engagement_tresorerie, formatDate)}
                             </div>
                             </Col>
                             <Col xs={6}>
                             <div className=' p-4 m-2 bg-white rounded-5 shadow-sm w-100 flex-fill' >{renderDetail2("Date Notification", marcheData.date_notification, formatDate)}
                    {renderDetail2("Date Début Exécution", marcheData.date_debut_execution, formatDate)}
                    {renderDetail2("Durée (jours)", marcheData.duree_marche, null)}</div>
                   
                             </Col>
                </Row>

                {/* Show spinner while loading Lots/Files/Convention */}
                {loadingRelated && <div className="text-center my-3"><Spinner animation="border" size="sm" /><span> Chargement des détails...</span></div>}

                {/* Lots Section */}
                 {!loadingRelated && lotsData && lotsData.length > 0 && (
                     <div className="mb-4 pb-3 border-bottom data-section">
                        <h5 className="mb-3 section-title text-uppercase fw-bold text-secondary">Lots Associés ({lotsData.length})</h5>
                        <Table striped  hover responsive size="sm" className="mytab">
                            <thead className="table-light">
                                <tr>
                                    <th>N° Lot</th>
                                    <th>Objet</th>
                                    <th className="text-end">Montant Attribué</th>
                                    <th>Attributaire</th>
                                    <th>Fichiers</th>
                                </tr>
                            </thead>
                             <tbody>
                                {lotsData.map(lot => (
                                    <tr key={lot.id}>
                                        <td>{lot.numero_lot || '-'}</td>
                                        <td>{lot.objet || '-'}</td>
                                        <td className="text-end">{formatCurrency(lot.montant_attribue)}</td>
                                        <td>{lot.attributaire || '-'}</td>
                                        <td>
                                            {lotFilesMap[lot.id]?.length > 0 ? (
                                                <Stack direction="horizontal" gap={2}>
                                                    {lotFilesMap[lot.id].map(file => {
                                                        const publicUrl = getPublicFileUrl(file.chemin_fichier);
                                                        return publicUrl ? (
                                                            <a
                                                                key={file.id}
                                                                href={publicUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-0 text-secondary"
                                                                title={`Ouvrir: ${file.nom_fichier}`}
                                                                aria-label={`Ouvrir ${file.nom_fichier}`}
                                                            >
                                                                <FontAwesomeIcon className='text-warning' icon={getFileIcon(file.nom_fichier || file.type_fichier)} />
                                                            </a>
                                                        ) : null;
                                                    })}
                                                </Stack>
                                            ) : (<span className="text-muted fst-italic">-</span>)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                 )}

                 {/* General Files Section */}
                {!loadingRelated && marketFiles && marketFiles.length > 0 && (
                    <div className="mb-3 data-section">
                        <h5 className="mb-3 section-title mb-3 section-title text-uppercase fw-bold text-secondary">Fichiers Généraux ({marketFiles.length})</h5>
                        <Stack className='d-flex flex-row  justify-content-evenly'>
                            {marketFiles.map(file => {
                                const publicUrl = getPublicFileUrl(file.chemin_fichier);
                                return (
                                    <div key={file.id} className="border rounded p-2 d-flex align-items-center bg-dark text-white">
                                        <FontAwesomeIcon icon={getFileIcon(file.nom_fichier || file.type_fichier)} className="me-2 fa-lg text-warning"/>
                                        <span className="me-auto small text-truncate" title={file.nom_fichier}>
                                            {file.nom_fichier || 'Fichier'}
                                        </span>
                                        {publicUrl ? (
                                            <a
                                                href={publicUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-sm btn-outline-warning py-0 px-1 ms-2"
                                                title="Ouvrir"
                                                aria-label={`Ouvrir ${file.nom_fichier}`}
                                            >
                                                <FontAwesomeIcon icon={faExternalLinkAlt} size="xs" className='text-warning'/>
                                            </a>
                                        ) : (
                                            <span className="text-muted fst-italic ms-2">(Lien indisponible)</span>
                                        )}
                                    </div>
                                );
                             })}
                        </Stack>
                    </div>
                )}

                {/* No Lots/Files Message */}
                 {!loadingRelated && (!lotsData || lotsData.length === 0) && (!marketFiles || marketFiles.length === 0) && (
                    <Alert variant='secondary' className='small py-2'><FontAwesomeIcon icon={faInfoCircle} className="me-2"/> Aucun lot ou fichier général joint pour ce marché.</Alert>
                 )}
             </div>
         </div>
    );
};

// --- PropTypes ---
MarchePublicVisualisation.propTypes = {
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    onClose: PropTypes.func, // Make onClose optional
    baseApiUrl: PropTypes.string.isRequired,
};

export default MarchePublicVisualisation;
