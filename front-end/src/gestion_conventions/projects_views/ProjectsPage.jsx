// src/pages/projets_views/ProjetsPage.jsx

import React, { useMemo } from 'react';
import DynamicTable from '../components/DynamicTable'; // Adjust path if needed
import ProjetForm from './ProjectForm'; // Adjust path if needed (Ensure this is the updated form)
import ProjetVisualisation from './ProjectVisualisation'; // Adjust path if needed (Ensure this is the updated visualisation)
import { useSearchParams } from 'react-router-dom';

// --- Constants ---
const BASE_API_URL = 'http://192.168.30.241:81/api'; // Make sure this is correct

// --- Helpers (Copied for consistency) ---
const formatPercentage = (value) => {
    const number = parseFloat(value);
    if (isNaN(number) || value === null || value === undefined) return '-';
    return `${number.toFixed(2)} %`;
};
const formatCurrency = (value) => {
    const number = parseFloat(value);
    if (isNaN(number) || value === null || value === undefined) return '-';
    return number.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const formatDateSimple = (dateString) => {
    if (!dateString) return '-';
    try {
        // Handle 'YYYY-MM-DD' or full ISO strings
        if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
             // Avoid timezone issues by parsing as UTC if only date is present
             return new Date(dateString).toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }); // Use fr-CA for YYYY-MM-DD
        }
        const date = new Date(dateString); // Try parsing directly for full ISO strings
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }); // Use fr-CA for YYYY-MM-DD
        }
        return dateString; // Fallback
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return dateString; // Fallback
    }
};
const formatDate = (dateString) => { // For timestamps
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date.toLocaleString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        }
        return dateString; // Fallback
    } catch (e) {
        console.error("Error formatting timestamp:", dateString, e);
        return dateString; // Fallback
    }
};
// --- End Helpers ---


const ProjetsPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const action = searchParams.get('action');
    const isCreating = action === 'create';
    // --- Column Definition ---
    const projetColumns = useMemo(() => [
        // Use EXACT Casing from schema/API response
        {
            accessorKey: 'Code_Projet', header: 'Code', size: 50,
            meta: { filterVariant: 'text', enableGlobalFilter: true } // Enable text filtering
        },
        {
            accessorKey: 'Nom_Projet', header: 'Nom Projet', size: 170,
            cell: info => <div className="text-truncate" style={{ maxWidth: '170px' }} title={info.getValue()}>{info.getValue() || '-'}</div>,
            meta: { filterVariant: 'text', enableGlobalFilter: true } // Enable text filtering
        },
        {
            id: 'Domaine', header: 'Domaine', size: 90,
            accessorFn: row => row.domaine?.Description || row.Id_Domaine || '-',
            meta: { filterVariant: 'text', enableGlobalFilter: true } // Enable text filtering
        },
        {
            id: 'Programme_Description', header: 'Programme', size: 170,
            accessorFn: row => row.programme?.Description || row.Id_Programme || '-',
            cell: info => { const fullText = info.getValue(); return (<div className="text-truncate" style={{ maxWidth: '170px' }} title={typeof fullText === 'string' ? fullText : undefined}>{fullText}</div>); },
            meta: { filterVariant: 'text', enableGlobalFilter: true } // Enable text filtering
        },
        // {
        //     accessorKey: 'Convention_Code', header: 'Code Conv.', size: 120,
        //     meta: { filterVariant: 'text', enableGlobalFilter: true } // Enable text filtering
        // },
        {
            accessorKey: 'Cout_Projet', header: 'Coût Projet', size: 130,
            cell: info => formatCurrency(info.getValue()),
            meta: { filterVariant: 'range', enableGlobalFilter: false } // Enable range filtering
        },
        {
            accessorKey: 'Etat_Avan_Physi', header: 'Av. Physi', size: 90,
            cell: info => formatPercentage(info.getValue()),
            meta: { filterVariant: 'range', enableGlobalFilter: false } // Enable range filtering
        },
        {
            accessorKey: 'Etat_Avan_Finan', header: 'Av. Finan', size: 90,
            cell: info => formatPercentage(info.getValue()),
            meta: { filterVariant: 'range', enableGlobalFilter: false } // Enable range filtering
        },
        {
            accessorKey: 'Date_Debut', header: 'Date Début', size:100,
            cell: info => formatDateSimple(info.getValue()),
            meta: { filterVariant: 'date', enableGlobalFilter: false } // Enable date filtering
        },
        { accessorKey: 'Date_Fin', header: 'Date Fin', cell: info => formatDateSimple(info.getValue()), size: 100, meta: { filterVariant: 'date', enableGlobalFilter: false } }, // Optional
        // {
        //     accessorKey: 'created_at', header: 'Créé le', size: 140,
        //     cell: info => formatDate(info.getValue()), // Use detailed format helper
        //     meta: { filterVariant: 'date', enableGlobalFilter: false } // Enable date filtering
        // },
        // 'actions' column added automatically by DynamicTable
    ], []);

    // --- DynamicTable Configuration ---
    // Define default visible columns using the accessorKey or id
    const defaultVisibleColumns = useMemo(() => [
        'Code_Projet', 'Nom_Projet', 'Programme_Description', 'Convention_Code',
        'Cout_Projet', 'Etat_Avan_Physi', 'Date_Fin', 'actions','Etat_Avan_Finan'
    ], []);

    // Define fields to exclude from the global search bar
    const searchExclusions = useMemo(() => [
        'ID_Projet',        // Primary Key
        'Id_Domaine',       // Foreign Key (covered by Domaine Description)
        'Id_Programme',     // Foreign Key (covered by Programme Description)
        'Id_Chantier',      // Foreign Key (might add Chantier description column if needed)
        'Cout_CRO',         // Specific cost field, maybe less searched
        'Date_Fin',
        'Etat_Avan_Finan',
        'created_at',
        'updated_at',
        'Observations',     // Usually long text, better filtered specifically if needed
        'domaine',          // The object itself
        'programme',        // The object itself
        'chantier',         // The object itself
        'convention',       // The object itself
        'engagements_financiers' // The array object itself
    ], []);

    // Configuration object for DynamicTable props
    const tableConfig = useMemo(() => ({
        // --- Core API & Data ---
        fetchUrl: "/projets",              // API endpoint to fetch data
        dataKey: "projets",                // Key in the API response containing the data array
        deleteUrlBase: "/projets",         // Base URL for DELETE requests (e.g., /projets/{id})
        identifierKey: "ID_Projet",        // Exact Case Primary Key column name from database/API
        columns: projetColumns,            // The column definitions created above
        itemName: "Projet",                // Singular name for messages
        itemNamePlural: "Projets",         // Plural name for messages

        // --- Display & Functionality ---
        displayKeyForDelete: "Code_Projet",// Field to display in delete confirmation (e.g., "Code_Projet")
        defaultVisibleColumns: defaultVisibleColumns, // Default columns shown
        globalSearchExclusions: searchExclusions,    // Fields excluded from global search
        itemsPerPage: 8,                  // Default items per page
        enableColumnFiltering: true,       // Enable per-column filters
        enableGlobalFiltering: true,       // Enable the global search bar
        enableSorting: true,               // Enable column sorting
        enablePagination: true,            // Enable table pagination
        enableRowSelection: false,         // Disable row selection checkboxes if not needed
        enableExport: true,                // Enable data export button

        // --- Components for Modals ---
        CreateComponent: ProjetForm,       // Component used for creating an item
        ViewComponent: ProjetVisualisation,// Component used for viewing item details
        EditComponent: ProjetForm,         // Component used for editing an item (can be same as create)

        // --- API & Formatting ---
        baseApiUrl: BASE_API_URL,          // Base URL for API calls from components
        formatDate: formatDate,            // Pass the detailed date formatter for use in DynamicTable meta
        formatDateSimple: formatDateSimple,// Pass the simple date formatter

        // --- Optional: Customizations ---
        // renderFilters: (table) => { /* Custom filter rendering logic */ },
        // customFilterFunctions: { /* Custom filter functions */ },
        // additionalToolbarButtons: (table) => { /* Add extra buttons */ },

    }), [projetColumns, defaultVisibleColumns, searchExclusions]); // Dependencies for useMemo
    const handleFormClose = (refreshNeeded = false) => {
        setSearchParams({});
      
    };

    return (
        // Container similar to ConventionsPage for consistent layout
        <div style={{ height: 'calc(100vh - 60px)', padding: '1rem' }}>
            {isCreating ? (
                // Show the form if action=create
                <ProjetForm
                    mode="create" // Tell the form it's in create mode
                    onClose={handleFormClose} // Pass handler for Cancel button
                    onSuccess={() => handleFormClose(true)} // Pass handler for successful Save (trigger refresh)
                    baseApiUrl={BASE_API_URL} // Pass the API URL
                    // Pass any other props needed by ProjetForm (e.g., dropdown options)
                />
            ) :<DynamicTable {...tableConfig} />}
        </div>
    );
};

export default ProjetsPage;