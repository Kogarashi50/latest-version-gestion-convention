<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Illuminate\Support\Facades\Log;
use Exception;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $guardName = 'sanctum'; // Ensure this matches your config/auth.php API guard

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $this->command->info('Permission cache cleared.');

        // --- Define Permissions (Existing + NEW) ---
        $permissions = [
            // Dashboard
            'view dashboard',
            // Conventions
            'view conventions', 'create conventions', 'update conventions', 'delete conventions', 'view convention details',
            // Partenaires
            'view partenaires', 'create partenaires', 'update partenaires', 'delete partenaires', 'view partenaire details',
            'view partenaire summary', // <-- NEW: For summary views
            // Chantiers
            'view chantiers', 'create chantiers', 'update chantiers', 'delete chantiers',
            // Programmes
            'view programmes', 'create programmes', 'update programmes', 'delete programmes',
            // Domaines
            'view domaines', 'create domaines', 'update domaines', 'delete domaines',
            // Projets
            'view projets', 'create projets', 'update projets', 'delete projets',
            // SousProjets
            'view sousprojets', 'create sousprojets', 'update sousprojets', 'delete sousprojets',
             // Communes
            'view communes', 'create communes', 'update communes', 'delete communes',
             // Marches (General)
            'view marches', 'create marches', 'update marches', 'delete marches',
            'download fichiers', // Specific action for file downloads related to Marches
             // Provinces
            'view provinces', 'create provinces', 'update provinces', 'delete provinces',
             // Engagements (Keep existing ones for EngagementController if still used)
            'view engagements', 'create engagements', 'update engagements', 'delete engagements',
             // Bon de Commande
            'view bon_commande', 'create bon_commande', 'update bon_commande', 'delete bon_commande',
             // Contrat Droit Commun
            'view contrat_droit_commun', 'create contrat_droit_commun', 'update contrat_droit_commun', 'delete contrat_droit_commun',
            // Avenants (Uncomment/add if needed)
            'view avenants', 'create avenants', 'update avenants', 'delete avenants',
            // Versements CP (Keep existing for VersementCPController if still used)
            'view versements_cp', 'create versements_cp', 'update versements_cp', 'delete versements_cp', // Renamed for clarity

            // --- NEW PERMISSIONS ---
            // Ordres de Service
            'view ordres_service', 'create ordres_service', 'update ordres_service', 'delete ordres_service',
            // Engagements Financiers (If distinct from 'engagements')
            'view engagements_financiers', 'create engagements_financiers', 'update engagements_financiers', 'delete engagements_financiers',
            // Versements PP (If distinct from 'versements_cp')
            'view versements_pp', 'create versements_pp', 'update versements_pp', 'delete versements_pp',
            // Reporting
            'download report',
            // -----------------------

            // --- Admin Area Permissions ---
            'manage users', // Full CRUD for Users
            'manage roles', // Full CRUD for Roles/Permissions
        ];

        // --- Create Permissions ---
        $this->command->info('Creating/Verifying permissions...');
        foreach ($permissions as $permissionName) {
            try {
                 Permission::firstOrCreate(['name' => $permissionName, 'guard_name' => $guardName]);
            } catch (Exception $e) {
                $this->command->error("Error creating/verifying permission '$permissionName': " . $e->getMessage());
            }
        }
        $this->command->info('Permissions created/verified.');


        // --- Define Roles ---
        $this->command->info('Creating/Verifying Roles...');
        $adminRole = null; $viewerRole = null;
        try {
            $adminRole = Role::firstOrCreate(['name' => 'Admin', 'guard_name' => $guardName]);
            $viewerRole = Role::firstOrCreate(['name' => 'Viewer', 'guard_name' => $guardName]);
            // $editorRole = Role::firstOrCreate(['name' => 'Editor', 'guard_name' => $guardName]);
        } catch (Exception $e) {
             $this->command->error("Error creating/verifying roles: " . $e->getMessage()); return;
        }
        $this->command->info('Roles created/verified (Admin, Viewer).');


        // --- Assign Permissions to ADMIN Role ---
        $this->command->info('Assigning all permissions to Admin role...');
        try {
            $allPermissions = Permission::where('guard_name', $guardName)->pluck('name');
            if ($adminRole) {
                $adminRole->syncPermissions($allPermissions);
                $this->command->info('All permissions synced to Admin role.');
            } else { $this->command->error("Role 'Admin' not found."); }
        } catch (Exception $e) { $this->command->error("Error assigning permissions to Admin role: " . $e->getMessage()); }


        // --- Assign Specific Permissions to VIEWER Role ---
        $this->command->info('Assigning permissions to Viewer role...');
        // Define only the permissions a Viewer should have (INCLUDING NEW VIEW PERMISSIONS)
        $viewerPermissionNames = [
             'view dashboard',
             'view conventions', 'view convention details',
             'view partenaires', 'view partenaire details',
             'view partenaire summary', // <-- NEW
             'view chantiers',
             'view programmes',
             'view domaines',
             'view projets',
             'view sousprojets',
             'view communes',
             'view marches',
             'download fichiers',
             'view provinces',
             'view engagements', // Assuming this is still relevant
             'view bon_commande',
             'view contrat_droit_commun',
             'view avenants', // Add if needed
             'view versements_cp', // Renamed
             // --- Add NEW view permissions ---
             'view ordres_service',
             'view engagements_financiers', // Add if distinct
             'view versements_pp', // Add if distinct
             'download report',
             // -------------------------------
        ];
        try {
            $viewerPermissions = Permission::where('guard_name', $guardName)
                                ->whereIn('name', $viewerPermissionNames)->get();
            if ($viewerRole) {
                $viewerRole->syncPermissions($viewerPermissions);
                $this->command->info('Viewer role permissions assigned (' . $viewerPermissions->count() . ' permissions).');
            } else { $this->command->error("Role 'Viewer' not found."); }
        } catch (Exception $e) { $this->command->error("Error assigning permissions to Viewer role: " . $e->getMessage()); }


        // --- USER CREATION / ROLE ASSIGNMENT REMOVED ---
        $this->command->info('Skipping user creation/assignment in this seeder.');


        // --- Final Steps ---
        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $this->command->info('Permission cache cleared.');
        $this->command->info('Roles and Permissions definition/assignment finished.');
        $this->command->warn('-----------------------------------------------------------');
        $this->command->warn("REMEMBER: Ensure Gate::before is setup in AuthServiceProvider if relying on it for Admin full access.");
        $this->command->warn("REMEMBER: Assign roles ('Admin', 'Viewer', etc.) to your existing users manually or via the application UI.");
        $this->command->warn('-----------------------------------------------------------');
    }
}