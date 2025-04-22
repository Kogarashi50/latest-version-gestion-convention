// src/gestion_conventions/appel_offres_views/AppelOffrePage.jsx

import React, { useMemo, useCallback } from 'react';
import DynamicTable from '../components/DynamicTable'; // Adjust path as needed
import AppelOffreForm from './AppelOffreForm'; // Component for Create/Edit (TO BE CREATED)
import AppelOffreVisualisation from './AppelOffreVisualisation'; // Component for View (TO BE CREATED)

// --- UI & Utilities ---
import Select from 'react-select';
import { Badge, Form, Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faBuilding, faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons';
import { useSearchParams } from 'react-router-dom';

// --- Constants & Helpers ---
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Reusable formatters (ensure consistency or move to a shared utils file)
const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        const datePart = dateString.split(' ')[0];
         if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) { return dateString; } // Return original if format unexpected
         return new Date(datePart + 'T00:00:00Z').toLocaleDateString('fr-CA'); // Use UTC to avoid timezone shifts, format YYYY-MM-DD
    } catch (e) { console.error("Date format error:", dateString, e); return dateString; }
};

const formatCurrency = (value) => {
    if (value == null || value === '' || isNaN(Number(value))) return '-';
    try {
        // Using fr-MA for Moroccan Dirham formatting
        return parseFloat(value).toLocaleString('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 });
    } catch (e) { console.error("Currency format error:", value, e); return String(value); }
};

const CATEGORIE_OPTIONS = [
    { value: 'Travaux', label: 'Travaux' },
    { value: 'Etudes', label: 'Etudes' },
    { value: 'Services', label: 'Services' },
    { value: 'Fournitures', label: 'Fournitures' }
];

const PORTAIL_FILTER_OPTIONS = [
    { value: 'true', label: 'Oui' }, // Use strings as values if filter expects string
    { value: 'false', label: 'Non' }
];
// --- End Helpers ---

// --- Main Page Component ---
const AppelOffrePage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const action = searchParams.get('action');
    const isCreating = action === 'create';

    // --- Column Definitions for the DynamicTable ---
    const appelOffreColumns = useMemo(() => [
        { accessorKey: 'numero', header: 'N° AO', size: 130, meta: { align: 'left', enableGlobalFilter: true } },
        {
            accessorKey: 'intitule', header: 'Intitulé', size: 200,
            meta: { align: 'left', enableGlobalFilter: true },
            cell: info => <div className="text-truncate" style={{ maxWidth: '200px' }} title={info.getValue()}>{info.getValue()}</div>,
        },
        {
            accessorKey: 'categorie', header: 'Catégorie', size: 100, filterFn: 'equalsString',
            meta: { align: 'center', enableGlobalFilter: true },
        },
        {
            id: 'provinceName', // Unique column ID
            header: 'Province',
            size: 130,
            accessorFn: row => row.province?.Description.replace('Province:','').trim(), // Access nested data: check 'province' and 'Description' names
            cell: info => {
                const provinceName = info.getValue();
                return provinceName
                    ? <div className="text-truncate" style={{ maxWidth: '130px' }} title={provinceName}>
                          <FontAwesomeIcon icon={faBuilding} className="me-1 text-muted small" /> {provinceName}
                      </div>
                    : '-';
            },
            meta: { align: 'left', enableGlobalFilter: true }, // Allow filtering/searching by province name
        },
        {
            accessorKey: 'estimation_HT', header: 'Estimation HT', size: 150,
            cell: info => formatCurrency(info.getValue()),
            meta: { align: 'right', enableGlobalFilter: false } // Usually don't globally filter currency
        },
        {
            accessorKey: 'date_ouverture', header: 'Date Ouverture', size: 140,
            cell: info => formatDate(info.getValue()),
            meta: { align: 'center', enableGlobalFilter: false } // Usually don't globally filter dates like this
        },
        {
            accessorKey: 'lancement_portail', header: 'Portail', size: 80, filterFn: 'equalsString', // Use string comparison if values are 'true'/'false' strings
            cell: info => {
                const isOnPortail = info.getValue(); // Should be boolean true/false from model cast
                return isOnPortail === true ?
                    <Badge bg="success" text="white" className="w-100"><FontAwesomeIcon icon={faToggleOn} /> Oui</Badge> :
                    <Badge bg="secondary" text="white" className="w-100"><FontAwesomeIcon icon={faToggleOff} /> Non</Badge>;
            },
            meta: { align: 'center', enableGlobalFilter: true }, // Allow filtering/searching by boolean state
        },
    ], []); // Dependency array is empty

    // --- Filter Rendering Function ---
    const renderAppelOffreFilters = useCallback((table) => {
        if (!table) return null;
        const categorieColumn = table.getColumn('categorie');
        const portailColumn = table.getColumn('lancement_portail');
        const isAnyColumnFiltered = table.getState().columnFilters.length > 0;

        // Get current filter value for portail (might be boolean or undefined)
        const currentPortailFilterValue = portailColumn?.getFilterValue();
        // Find the matching option object based on the filter value (needs string comparison)
        const selectedPortailOption = PORTAIL_FILTER_OPTIONS.find(option => option.value === String(currentPortailFilterValue)) || null;

        return (
            <Form>
                {/* Catégorie Filter */}
                <Form.Group controlId="filterCategorieAO" className="mb-3">
                   <Form.Label className="small mb-1 fw-bold">Catégorie</Form.Label>
                   <Select
                       inputId="filterCategorieAOSelect"
                       options={CATEGORIE_OPTIONS}
                       value={CATEGORIE_OPTIONS.find(option => option.value === categorieColumn?.getFilterValue()) || null}
                       onChange={option => categorieColumn?.setFilterValue(option?.value ?? undefined)}
                       placeholder="Toutes Catégories..." isClearable
                       styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }} menuPortalTarget={document.body}
                       aria-label="Filtrer par catégorie d'appel d'offre"
                   />
                </Form.Group>

                {/* Lancement Portail Filter */}
                <Form.Group controlId="filterPortail" className="mb-3">
                    <Form.Label className="small mb-1 fw-bold">Lancé sur Portail</Form.Label>
                   <Select
                       inputId="filterPortailSelect"
                       options={PORTAIL_FILTER_OPTIONS}
                       value={selectedPortailOption} // Use the found option object
                       onChange={option => {
                           // Set filter value as string ('true'/'false') or undefined if cleared
                           portailColumn?.setFilterValue(option?.value ?? undefined);
                       }}
                       placeholder="Oui / Non / Tous..." isClearable
                       styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }} menuPortalTarget={document.body}
                       aria-label="Filtrer par lancement sur portail"
                   />
                </Form.Group>

                {/* Reset Button */}
                <Button variant="outline-secondary" size="sm" onClick={() => table.resetColumnFilters()} disabled={!isAnyColumnFiltered} className="w-100 mt-3">
                   <FontAwesomeIcon icon={faTimes} className="me-2"/> Réinitialiser Filtres Spécifiques
                </Button>
            </Form>
        );
    }, []); // Dependency array is empty


    // --- DynamicTable Configuration ---
    // Define which columns are visible by default
    const defaultVisibleCols = useMemo(() => [
        'numero',
        'intitule',
        'categorie',
        'provinceName', // Show the province name
        'estimation_HT',
        'date_ouverture',
        'lancement_portail',
        'actions', // Keep actions column visible
    ], []);

    const handleFormClose = () => {
        setSearchParams({}); // Clear URL params to return to table view
        // Optional: Add logic here or inside DynamicTable to trigger data refresh if needed
    };

    return (
        // Ensure parent container allows this div to take full height if needed
        <div style={{ height: 'calc(100vh - 56px)', padding: '1rem', overflowY: 'auto' }}>
              {isCreating ? (
                  // Show the form if action=create
                  <AppelOffreForm
                       // Pass necessary props to the Form component
                       onClose={handleFormClose}
                       onItemCreated={handleFormClose} // Close form on successful creation
                       baseApiUrl={BASE_API_URL}
                       // itemId will be undefined/null in create mode
                   />
              ) : (
                  // Show the table view by default
                  <DynamicTable
                      // --- Data Fetching ---
                      fetchUrl="/appel-offres" // API endpoint for fetching the list
                      // Assuming the Laravel paginator response: { data: [...], links: ..., meta: ... }
                      // DynamicTable needs to be adapted or use a wrapper if it only expects an array.
                      // If DynamicTable handles paginators, 'data' might be the key. Verify this.
                      dataKey="data" // Key holding the array of items in the response
                      deleteUrlBase="/appel-offres" // Base URL for DELETE requests
                      baseApiUrl={BASE_API_URL}

                      // --- Table Definition ---
                      columns={appelOffreColumns}
                      itemName="Appel d'Offre"
                      itemNamePlural="Appels d'Offre"
                      identifierKey="id" // Primary key field name
                      displayKeyForDelete="numero" // Field to show in delete confirmation

                      // --- Features ---
                      itemsPerPage={10}
                      defaultVisibleColumns={defaultVisibleCols}
                      renderFilters={renderAppelOffreFilters} // Pass the filter rendering function
                      enableGlobalSearch={true} // Enable global search input

                      // --- Component Integration ---
                      // Pass the components DynamicTable should use for actions
                      CreateComponent={AppelOffreForm}
                      ViewComponent={AppelOffreVisualisation}
                      EditComponent={AppelOffreForm}

                      // --- Styling & Misc ---
                      actionColumnWidth={90} // Adjust width for action buttons if needed
                      tableClassName="table-striped table-hover" // Standard Bootstrap classes
                  />
              )}
        </div>
    );
};

export default AppelOffrePage;