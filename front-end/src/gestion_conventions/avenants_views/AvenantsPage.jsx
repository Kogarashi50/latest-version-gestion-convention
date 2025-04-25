import React, { useMemo, useState, useCallback, useEffect } from 'react';
import DynamicTable from '../components/DynamicTable'; // Adjust path if needed
import AvenantForm from './AvenantForm'; // Adjust path
import AvenantVisualisation from './AvenantVisualisation'; // Adjust path

// Import UI components and icons
import Select from 'react-select';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faUsers } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';

// --- Helpers --- (Keep existing helpers: formatDate, formatCurrency, etc.)
const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString + 'T00:00:00Z');
        return date.toLocaleDateString('fr-CA');
    } catch (e) { return dateString; }
};
const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(Number(amount))) return '-';
    return parseFloat(amount).toLocaleString('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 });
};
const getTypeModificationColor = (type) => {
    switch (type) {
        case 'montant': return 'success';
        case 'durée': return 'info';
        case 'partenaire': return 'warning';
        case 'autre': return 'secondary';
        default: return 'light';
    }
};
const createSelectOptions = (data, valueKey, labelKey) => {
    if (!data || !Array.isArray(data)) return [];
    const uniqueMap = new Map();
    data.forEach(item => {
        if (item && item[valueKey] !== null && item[valueKey] !== undefined) {
            const labelValue = labelKey && item[labelKey] ? item[labelKey] : item[valueKey];
            const label = String(labelValue);
            if (!uniqueMap.has(item[valueKey])) {
                uniqueMap.set(item[valueKey], { value: item[valueKey], label: label });
            }
        }
    });
    return Array.from(uniqueMap.values()).sort((a, b) =>
        String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' })
    );
};


// --- Component ---
const AvenantsPage = () => {
    const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

    // --- State for Select Options ---
    const [conventionOptions, setConventionOptions] = useState([]);
    const [typeModificationOptions] = useState([
        { value: 'montant', label: 'Montant' },
        { value: 'durée', label: 'Durée' },
        { value: 'partenaire', label: 'Partenaire(s)' },
        { value: 'autre', label: 'Autre' },
    ]);
    const [optionsLoading, setOptionsLoading] = useState(true);

    // --- Fetch Options for Selects ---
    useEffect(() => {
        const fetchFilterOptions = async () => {
            console.log("Fetching options for Avenant filters...");
            setOptionsLoading(true);
            try {
                const convRes = await axios.get(`${BASE_API_URL}/conventions`, { params: { light: true }, withCredentials: true });
                const conventions = Array.isArray(convRes.data?.conventions) ? convRes.data.conventions : (Array.isArray(convRes.data) ? convRes.data : []);
                const mappedConvOptions = conventions
                    .filter(c => c?.id !== undefined && c?.Code !== undefined && c?.Intitule !== undefined)
                    .map(c => ({ value: c.id, label: `${c.Code} - ${c.Intitule}` }))
                    .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }));
                setConventionOptions(mappedConvOptions);
                console.log("Convention Options for Filter:", mappedConvOptions.length);

            } catch (error) {
                console.error("Error fetching convention options:", error);
                setConventionOptions([]);
            } finally {
                setOptionsLoading(false);
                console.log("Finished fetching options for Avenant filters.");
            }
        };
        fetchFilterOptions();
    }, [BASE_API_URL]);

    // --- Column Definition ---
    const avenantColumns = useMemo(() => [
        {
            id: 'convention',
            header: 'Convention Parent',
            accessorFn: row => row.convention ? `${row.convention?.Code} - ${row.convention?.Intitule}` : `ID: ${row.convention_id}`,
            cell: info => <div className="text-truncate" title={info.getValue()} style={{ maxWidth: '300px' }}>{info.getValue() || '-'}</div>,
            size: 300,
            meta: { enableGlobalFilter: true }
        },
        {
             accessorKey: 'numero_avenant', header: 'N° Avenant', size: 110,
             meta: { enableGlobalFilter: true }
        },
        {
             accessorKey: 'objet', header: 'Objet', size: 200,
             cell: info => <div className="text-truncate" title={info.getValue()} style={{ width: '300px' }}>{info.getValue()||'-'}</div>,
             meta: { enableGlobalFilter: true }
         },
         {
             accessorKey: 'type_modification', header: 'Type Modif.', size: 120, filterFn: 'equalsString',
             cell: info => {
                 const type = info.getValue();
                 const color = getTypeModificationColor(type);
                 const label = typeModificationOptions.find(opt => opt.value === type)?.label || type;
                 return type ? <Badge bg={color} text={color === 'light' || color === 'warning' ? 'dark' : 'white'} className="d-flex justify-content-center text-truncate">{label}</Badge> : '-';
             },
             meta: { enableGlobalFilter: true }
         },
        {
             accessorKey: 'date_signature', header: 'Date Signature', size: 140,
             cell: info => formatDate(info.getValue()),
             meta: { enableGlobalFilter: false }
         },
        {
            id: 'files_count', header: <FontAwesomeIcon icon={faPaperclip} title="Fichiers" />,
            accessorFn: row => row.documents?.length ?? 0,
            cell: info => <span className={`text-center px-2 py-1 small rounded-5 ${info.getValue() !==0?'bg-warning':'bg-dark text-white'} fw-bold`}>{info.getValue()}</span>,
            size: 30, enableSorting: false, meta: { enableGlobalFilter: false }
        },
        {
            id: 'partners_count', header: <FontAwesomeIcon icon={faUsers} title="Partenaires Affectés" />,
            // *** IMPORTANT: Use the correct key name 'partner_commitments' ***
            accessorFn: row => row.partner_commitments?.length ?? 0, // <-- CORRECTED KEY
            cell: info => <span className={`text-center px-2 py-1 small rounded-5 ${info.getValue() !==0?'bg-warning':'bg-dark text-white'} fw-bold`}>{info.getValue()}</span>,
            size: 30, enableSorting: false, meta: { enableGlobalFilter: false }
        },
         {
             accessorKey: 'montant_modifie', header: 'Montant Modifié', size: 100,
             cell: info => info.row.original.type_modification === 'montant' ? formatCurrency(info.getValue()) : '-',
             meta: { enableGlobalFilter: false }
         },
         {
             accessorKey: 'nouvelle_date_fin', header: 'Nouv. Date Fin', size: 100,
             cell: info => info.row.original.type_modification === 'durée' ? formatDate(info.getValue()) : '-',
             meta: { enableGlobalFilter: false }
         },

    ], [typeModificationOptions]);

    // --- Local Filter State ---
    const [filterConvention, setFilterConvention] = useState(null);
    const [filterTypeModification, setFilterTypeModification] = useState(null);

    // --- Filter Rendering Function ---
    const renderAvenantFilters = useCallback((table) => {
        const conventionColumn = table.getColumn('convention');
        const typeModifColumn = table.getColumn('type_modification');

        return (
            <Row className="mb-3 gx-2 d-flex flex-column gy-2 align-items-end">
                <Col xs="12"><h6 className='mb-1'>Filtrer par:</h6></Col>
                 {/* Convention Filter */}
                 {conventionColumn && (
                    <Col xs={12} sm={12} md={12} lg={12}>
                        <Select
                            inputId="filterConvention"
                            name="conventionFilter"
                            options={conventionOptions}
                            value={filterConvention}
                            onChange={(selectedOption) => {
                                 setFilterConvention(selectedOption);
                                 conventionColumn.setFilterValue(selectedOption ? selectedOption.label : undefined);
                            }}
                            placeholder="Convention..."
                            isClearable
                            isLoading={optionsLoading}
                            styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }), control: (base) => ({...base, minHeight: '32px', fontSize: '0.85rem'}), valueContainer: (base) => ({...base, padding: '0px 6px'}) }}
                            menuPortalTarget={document.body}
                            classNamePrefix="react-select-filter"
                            theme={(theme) => ({ ...theme, borderRadius: 4, colors: { ...theme.colors, primary: '#0d6efd' } })}
                        />
                    </Col>
                 )}

                {/* Type Modification Filter */}
                {typeModifColumn && (
                    <Col xs={12} sm={12} md={12} lg={12}>
                        <Select
                            inputId="filterTypeModification"
                            name="typeModifFilter"
                            options={typeModificationOptions}
                            value={filterTypeModification}
                            onChange={(selectedOption) => {
                                setFilterTypeModification(selectedOption);
                                typeModifColumn.setFilterValue(selectedOption ? selectedOption.value : undefined);
                            }}
                            placeholder="Type Modification..."
                            isClearable
                            styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }), control: (base) => ({...base, minHeight: '32px', fontSize: '0.85rem'}), valueContainer: (base) => ({...base, padding: '0px 6px'}) }}
                            menuPortalTarget={document.body}
                            classNamePrefix="react-select-filter"
                            theme={(theme) => ({ ...theme, borderRadius: 4, colors: { ...theme.colors, primary: '#0d6efd' } })}
                        />
                    </Col>
                )}

                 {/* Button to clear all filters */}
                 <Col xs="12">
                     <Button
                         variant="outline-secondary"
                         size="sm"
                         className="px-3"
                         onClick={() => {
                             setFilterConvention(null);
                             setFilterTypeModification(null);
                             table.resetColumnFilters();
                         }}
                         title="Réinitialiser les filtres"
                     >
                         Effacer
                     </Button>
                 </Col>
            </Row>
        );
    }, [filterConvention, filterTypeModification, conventionOptions, typeModificationOptions, optionsLoading]);


    // --- DynamicTable Configuration ---
    const defaultCols = useMemo(() => [
        'convention', 'numero_avenant', 'objet', 'type_modification',
        'date_signature', 'files_count', 'partners_count', 'actions'
    ], []);
    const availableCols = useMemo(() => [
        'id', 'convention', 'numero_avenant', 'date_signature', 'objet',
        'type_modification', 'montant_modifie', 'nouvelle_date_fin',
        'files_count', 'partners_count', 'remarques', 'date_creation',
    ], []);
    const searchExclusions = useMemo(() => [
        'id', 'convention_id', 'montant_modifie', 'nouvelle_date_fin',
        'files_count', 'partners_count', 'date_signature', 'date_creation', 'updated_at', 'remarques'
    ], []);

     // *** IMPORTANT: Update include param to use correct snake_case name ***
     const includeParam = useMemo(() => {
        // Use 'partner_commitments.partenaire' as identified from the working API response
        return 'convention,documents,partner_commitments.partenaire'; // <-- CORRECTED KEY
     }, []);

    return (
        <div style={{ height: 'calc(100vh - 56px - 2rem)', padding: '1rem', overflowY: 'auto' }}>
            <DynamicTable
                // --- Core ---
                fetchUrl="/avenants"
                // *** Pass the corrected include param ***
                fetchParams={{ include: includeParam }} // <-- Ensure this is passed
                dataKey="avenants"
                deleteUrlBase="/avenants"
                baseApiUrl={BASE_API_URL}

                // --- Columns & Display ---
                columns={avenantColumns}
                itemName="Avenant"
                itemNamePlural="Avenants"
                identifierKey="id"
                displayKeyForDelete="numero_avenant"

                // --- Options ---
                itemsPerPage={8}
                defaultVisibleColumns={defaultCols}
                availableColumnKeys={availableCols}
                globalSearchExclusions={searchExclusions}
                enableManualFiltering={true}
                enableGlobalSearch={true}

                // --- Components ---
                CreateComponent={AvenantForm}
                ViewComponent={AvenantVisualisation}
                EditComponent={AvenantForm}
                renderFilters={renderAvenantFilters}

                // --- Styling & Actions ---
                actionColumnWidth={90}
                tableClassName="table-striped table-hover table-sm"
            />
        </div>
    );
};

export default AvenantsPage;