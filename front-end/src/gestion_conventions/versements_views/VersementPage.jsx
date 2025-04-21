import React, { useMemo, useState, useCallback, useEffect } from 'react';
import DynamicTable from '../components/DynamicTable'; // ADJUST PATH if needed
import VersementForm from './VersementForm'; // ADJUST PATH if needed
import VersementVisualisation from './VersementVisualisation'; // ADJUST PATH if needed

// Import UI components and icons
import Select from 'react-select';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import InputGroup from 'react-bootstrap/InputGroup';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilterCircleXmark, faMagnifyingGlass, faFileContract, faHandshake } from '@fortawesome/free-solid-svg-icons';

// --- Helpers ---
const formatDate = (dateString) => {
    if (!dateString || typeof dateString !== 'string') return '-';
    try {
        if (/^\d{2}\/\d{2}\/\d{4}/.test(dateString)) return dateString;
        // Try parsing YYYY-MM-DD or full ISO (treat date part as UTC)
        const date = new Date(dateString.split('T')[0] + 'T00:00:00Z');
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('fr-CA', { // Use YYYY-MM-DD format
            year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC'
        });
    } catch (e) { console.error("formatDate Error:", dateString, e); return dateString; }
};

const formatCurrency = (amount) => {
    const number = parseFloat(amount);
    if (isNaN(number)) return '-';
    return number.toLocaleString('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 });
};

const PAIEMENT_METHODE_OPTIONS = [
    { value: "Virement", label: "Virement Bancaire" }, { value: "Chèque", label: "Chèque" },
    { value: "Espèces", label: "Espèces" }, { value: "Autre", label: "Autre" },
];
// --- End Helpers ---


// --- Filter Functions ---
const amountRangeFilterFn = (row, columnId, filterValue) => {
    const rowValue = parseFloat(row.getValue(columnId));
    if (isNaN(rowValue)) return true;

    const min = filterValue?.min !== undefined && filterValue.min !== '' ? parseFloat(filterValue.min) : undefined;
    const max = filterValue?.max !== undefined && filterValue.max !== '' ? parseFloat(filterValue.max) : undefined;

    if (min !== undefined && !isNaN(min) && rowValue < min) return false;
    if (max !== undefined && !isNaN(max) && rowValue > max) return false;
    return true;
};

const dateRangeFilterFn = (row, columnId, filterValue) => {
    try {
        const rowValueStr = row.getValue(columnId);
        if (!rowValueStr) return !filterValue?.start && !filterValue?.end;

        const rowDate = new Date(rowValueStr); // Compare dates only UTC
        if (isNaN(rowDate.getTime())) return true;

        const startStr = filterValue?.start;
        const endStr = filterValue?.end;
        let startDate, endDate;

        if (startStr) {
            startDate = new Date(startStr);
            if (!isNaN(startDate.getTime()) && rowDate < startDate) return false;
        }
        if (endStr) {
            endDate = new Date(endStr); // End of day UTC
            if (!isNaN(endDate.getTime()) && rowDate > endDate) return false;
        }
        return true;
    } catch (e) { console.error("Error in dateRangeFilterFn:", e); return true; }
};
// --- End Filter Functions ---


// --- Standalone Filter Component ---
const RenderVersementFiltersComponent = ({
    table,
    externalFilterConvPartId,
    setExternalFilterConvPartId,
    paiementMethodeOptions,
    optionsLoading,
}) => {
    // Get initial values from table state (useful if table state persists)
    const initialDateFilter = table.getColumn('date_versement')?.getFilterValue() || {};
    const initialAmountFilter = table.getColumn('montant_verse')?.getFilterValue() || {};
    const initialMoyenFilter = table.getColumn('moyen_paiement')?.getFilterValue();

    // Local state for filter inputs within this component
    const [localDateDebut, setLocalDateDebut] = useState(initialDateFilter.start || '');
    const [localDateFin, setLocalDateFin] = useState(initialDateFilter.end || '');
    const [localMoyenPaiement, setLocalMoyenPaiement] = useState(
        paiementMethodeOptions.find(opt => opt.value === initialMoyenFilter) || null
    );
    const [localMontantMin, setLocalMontantMin] = useState(initialAmountFilter.min || '');
    const [localMontantMax, setLocalMontantMax] = useState(initialAmountFilter.max || '');

    // Get column instances for applying filters
    const dateColumn = table.getColumn('date_versement');
    const moyenPaiementColumn = table.getColumn('moyen_paiement');
    const montantColumn = table.getColumn('montant_verse');

    // Apply date/amount range filters to the table state
    const applyRangeFilters = () => {
        dateColumn?.setFilterValue(
            (localDateDebut || localDateFin) ? { start: localDateDebut || undefined, end: localDateFin || undefined } : undefined
        );
        montantColumn?.setFilterValue(
            (localMontantMin || localMontantMax) ? { min: localMontantMin || undefined, max: localMontantMax || undefined } : undefined
        );
    };

    // Handle select change for Moyen Paiement
    const handleSelectChange = (selectedOption) => {
        setLocalMoyenPaiement(selectedOption);
        moyenPaiementColumn?.setFilterValue(selectedOption?.value ?? undefined);
    };

    // Reset all local and external filters
    const resetAllFilters = () => {
        setLocalDateDebut(''); setLocalDateFin('');
        setLocalMoyenPaiement(null);
        setLocalMontantMin(''); setLocalMontantMax('');
        setExternalFilterConvPartId(''); // Reset external state -> triggers URL change / refetch
        table.resetColumnFilters();
        table.setGlobalFilter('');
    };

    // Styles for react-select
    const selectStyles = { control: base => ({ ...base, minHeight: '31px', fontSize: '0.875rem' }) };

    return (
        <Form className="p-2 border bg-light rounded mb-2 small" onSubmit={(e) => {e.preventDefault(); applyRangeFilters();}}>
            <Row className="g-2 align-items-end">
                {/* ID Engagement Filter (External State) */}
                <Col xs={12} >
                    <Form.Group controlId="filterConvPartId">
                        <Form.Label size="sm" className="mb-1 fw-bold">ID Engagement (CP)</Form.Label>
                        <Form.Control
                            type="number" size="sm"
                            placeholder="Filtrer par ID_CP"
                            value={externalFilterConvPartId} // Read from external state
                            onChange={(e) => setExternalFilterConvPartId(e.target.value)} // Update external state
                            aria-label="Filtrer par ID Engagement"
                        />
                    </Form.Group>
                </Col>

                {/* Date Range Filter (Local State) */}
                <Col xs={12}>
                    <Form.Group controlId="filterDateRange">
                        <Form.Label size="sm" className="mb-1 fw-bold">Date Versement</Form.Label>
                        <InputGroup size="sm">
                            <Form.Control type="date" title="Date début" value={localDateDebut} onChange={(e) => setLocalDateDebut(e.target.value)} aria-label="Date début versement"/>
                            <Form.Control type="date" title="Date fin" value={localDateFin} onChange={(e) => setLocalDateFin(e.target.value)} aria-label="Date fin versement"/>
                        </InputGroup>
                    </Form.Group>
                </Col>

                {/* Moyen Paiement Filter (Local State + Table State) */}
                <Col xs={12}>
                    <Form.Group controlId="filterMoyenPaiement">
                        <Form.Label size="sm" className="mb-1 fw-bold">Moyen Paiement</Form.Label>
                        <Select
                            options={paiementMethodeOptions} value={localMoyenPaiement} onChange={handleSelectChange}
                            placeholder="Tous" isClearable size="sm" styles={selectStyles} isLoading={optionsLoading}
                            aria-label="Filtrer par moyen de paiement"
                         />
                    </Form.Group>
                </Col>

                {/* Montant Range Filter (Local State) */}
                <Col xs={12}>
                    <Form.Group controlId="filterMontantRange">
                        <Form.Label size="sm" className="mb-1 fw-bold">Montant Versé</Form.Label>
                        <InputGroup size="sm">
                            <Form.Control type="number" placeholder="Min" step="0.01" value={localMontantMin} onChange={(e) => setLocalMontantMin(e.target.value)} aria-label="Montant minimum"/>
                            <Form.Control type="number" placeholder="Max" step="0.01" value={localMontantMax} onChange={(e) => setLocalMontantMax(e.target.value)} aria-label="Montant maximum"/>
                        </InputGroup>
                    </Form.Group>
                </Col>

                {/* Action Buttons */}
                <Col xs={12} className="d-flex flex-column justify-content-end">
                    <Button type="submit" variant="primary" size="sm" title="Appliquer filtres Date/Montant">
                       <FontAwesomeIcon icon={faMagnifyingGlass} /> <span className="d-none d-lg-inline ms-1">Filtrer</span>
                    </Button>
                </Col>
                <Col xs={12} className="d-flex flex-column justify-content-end">
                    <Button variant="outline-secondary" size="sm" onClick={resetAllFilters} title="Réinitialiser tous les filtres">
                        <FontAwesomeIcon icon={faFilterCircleXmark} /> <span className="d-none d-lg-inline ms-1">Reset</span>
                    </Button>
                </Col>
            </Row>
        </Form>
    );
};
// --- End Standalone Filter Component ---


// --- Main Page Component ---
const VersementPage = () => {
    const BASE_API_URL = 'http://192.168.30.241:81/api'; // MAKE SURE THIS IS CORRECT
    const [paiementMethodeOptions] = useState(PAIEMENT_METHODE_OPTIONS);
    const [optionsLoading, setOptionsLoading] = useState(false);

    // State for URL-based filter (triggers refetch via key prop)
    const [filterConvPartId, setFilterConvPartId] = useState('');

    // --- Column Definition ---
    const versementColumns = useMemo(() => [
        { accessorKey: 'id', header: 'ID', size: 30, enableHiding: true, enableColumnFilter: false, meta: { enableGlobalFilter: false } },
        {
            id: 'convention_details', header: 'Convention', filterFn: 'includesString',
            accessorFn: row => {
                 const conv = row.conv_part?.convention;
                 // Check if conv exists before accessing properties
                 return conv ? `${conv.code || ''} ${conv.intitule || ''}`.trim() : '';
            },
            cell: info => {
                // Access original row data safely
                const convention = info.row.original.conv_part?.convention;
                if (!convention) return '-';
                const displayText = `${convention.code || ''}${convention.intitule ? ' - ' + convention.intitule : ''}`;
                return ( <div className="text-truncate" style={{ maxWidth: '170px' }} title={displayText}> <FontAwesomeIcon icon={faFileContract} className="me-2 text-primary opacity-75" /> {displayText || '-'} </div> );
            },
            size: 200, meta: { enableGlobalFilter: true }
        },
        {
            id: 'partenaire_details', header: 'Partenaire', filterFn: 'includesString',
            accessorFn: row => row.conv_part?.partenaire?.Description || row.conv_part?.partenaire?.Description_Arr ,
            cell: info => {
                const description = info.getValue();
                return ( <div className="text-truncate" style={{ maxWidth: '170px' }} title={description}> {description ? (<><FontAwesomeIcon icon={faHandshake} className="me-2 text-success opacity-75" />{description}</> ) : ( '-' )} </div> );
             },
            size: 170, meta: { enableGlobalFilter: true }
        },
        {
            accessorKey: 'date_versement', header: 'D. Versement',
            cell: info => formatDate(info.getValue()),
            size: 110, meta: { filterVariant: 'date-range', enableGlobalFilter: false },
            filterFn: 'dateRange'
        },
        {
            accessorKey: 'montant_verse', header: 'Montant Versé',
            cell: info => formatCurrency(info.getValue()),
            size: 130, meta: { filterVariant: 'range', enableGlobalFilter: false },
            filterFn: 'amountRange'
        },
        {
            accessorKey: 'moyen_paiement', header: 'Moyen Paiem.',
            cell: info => info.getValue() || '-',
            size: 120, meta: { filterVariant: 'select', filterOptions: PAIEMENT_METHODE_OPTIONS, enableGlobalFilter: true },
            filterFn: 'equalsString'
        },
        { accessorKey: 'reference_paiement', header: 'Référence', cell: info => <div className="text-truncate" style={{ maxWidth: '100px' }} title={info.getValue()}>{info.getValue() || '-'}</div>, size: 100, meta: { enableGlobalFilter: true } },
        { accessorKey: 'commentaire', header: 'Commentaire', cell: info => <div className="text-truncate" style={{ maxWidth: '170px' }} title={info.getValue()}>{info.getValue() || '-'}</div>, size: 170, enableHiding: true, meta: { enableGlobalFilter: true } },
    ], [paiementMethodeOptions]);


    // --- Prepare Filter Rendering Function ---
    // This function will be passed to DynamicTable and will render the separate filter component
    const renderFilters = useCallback((table) => (
        <RenderVersementFiltersComponent
            table={table}
            externalFilterConvPartId={filterConvPartId}
            setExternalFilterConvPartId={setFilterConvPartId}
            paiementMethodeOptions={paiementMethodeOptions}
            optionsLoading={optionsLoading}
        />
    ), [filterConvPartId, paiementMethodeOptions, optionsLoading]); // Dependencies


    // --- DynamicTable Configuration ---
    const defaultCols = useMemo(() => [ 'convention_details', 'partenaire_details', 'date_versement', 'montant_verse', 'moyen_paiement', 'reference_paiement', 'actions' ], []);
    const availableCols = useMemo(() => [ 'id', 'convention_details', 'partenaire_details', 'date_versement', 'montant_verse', 'moyen_paiement', 'reference_paiement', 'commentaire' ], []);
    const searchExclusions = useMemo(() => [ 'id', 'montant_verse', 'date_versement' ], []);

    // API Fetch URL depends on filterConvPartId state
    const dynamicFetchUrl = useMemo(() => {
        let url = "/versements"; // Route for VersementCPController
        if (filterConvPartId && filterConvPartId.trim() !== '') {
            // Ensure the parameter name matches what VersementCPController expects
            url += `?convpart_id=${encodeURIComponent(filterConvPartId.trim())}`;
        }
        return url;
    }, [filterConvPartId]);

    // --- Render DynamicTable ---
    return (
        <div className="container-fluid mt-3">
            <DynamicTable
                key={dynamicFetchUrl} // Force remount on URL change
                fetchUrl={dynamicFetchUrl}
                dataKey="versements" // Key in API response holding the array
                deleteUrlBase="/versements" // Route for VersementCPController
                columns={versementColumns}
                itemName="Versement"
                itemNamePlural="Versements"
                identifierKey="id" // Primary key of VersementCP model
                displayKeyForDelete="reference_paiement" // Field to show in delete confirmation
                defaultVisibleColumns={defaultCols}
                availableColumnKeys={availableCols}
                globalSearchExclusions={searchExclusions}
                itemsPerPage={8}
                customFilterFunctions={{ amountRange: amountRangeFilterFn, dateRange: dateRangeFilterFn }}
                baseApiUrl={BASE_API_URL}
                CreateComponent={VersementForm}
                ViewComponent={VersementVisualisation}
                EditComponent={VersementForm}
                // Pass the function that renders the filters
                renderFilters={renderFilters} // ADJUST PROP NAME if DynamicTable expects 'RenderFiltersComponent'
                enableColumnFiltering={true} // Enable column filters internally
                enableGlobalFiltering={true}
            />
        </div>
    );
};

export default VersementPage;