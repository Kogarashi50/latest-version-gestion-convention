<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB; // Needed for raw statements if using FK check disable

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @NOTE: This migration combines many tables. Standard practice is one file per table/feature.
     * Review data types (decimal, date, nullable) carefully.
     * Ensure table/column names match your models and existing data if migrating on existing DB.
     */
    public function up(): void
    {
        // --- Base Application Tables (Attempting logical order) ---

        Schema::create('domaines', function (Blueprint $table) {
            $table->id();
            $table->string('description');
            $table->string('code_domaine')->unique(); // Added unique constraint assumption
            $table->string('description_arr')->nullable();
            $table->timestamps();
        });

        Schema::create('chantiers', function (Blueprint $table) {
            $table->id();
            $table->string('description');
            $table->string('code_chantier')->unique(); // Added unique constraint assumption
            $table->foreignId('id_domaine')->constrained('domaines')->cascadeOnDelete(); // Use constrained helper
            $table->timestamps();
        });

        Schema::create('programmes', function (Blueprint $table) {
            $table->id();
            $table->string('description');
            $table->string('code_programme')->unique(); // Added unique constraint assumption
            $table->foreignId('id_chantier')->constrained('chantiers')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('partenaires', function (Blueprint $table) {
            $table->id(); // Changed from Id to id for consistency
            $table->string('description');
            $table->string('code')->unique(); // Added unique constraint assumption
            $table->string('description_arr')->nullable();
            $table->timestamps();
        });

        Schema::create('communes', function (Blueprint $table) {
            $table->id(); // Changed from Id to id
            $table->string('code')->unique(); // Added unique constraint assumption
            $table->string('description');
            $table->string('description_arr')->nullable();
            $table->timestamps();
        });

        Schema::create('provinces', function (Blueprint $table) {
            $table->id(); // Changed from Id to id
            $table->string('code')->unique(); // Added unique constraint assumption
            $table->string('description');
            $table->string('description_arr')->nullable();
            $table->timestamps();
        });

        Schema::create('utilisateurs', function (Blueprint $table) {
            $table->id('idutilisateur'); // Specify custom primary key name
            $table->string('username')->unique();
            $table->string('password');
            // $table->string('role'); // REMOVED - Spatie handles roles
            $table->rememberToken(); // Standard Laravel user table column
            $table->timestamps();
        });

        // Note: Changed 'convention' table name to 'conventions' (plural) for consistency
        Schema::create('conventions', function (Blueprint $table) {
            $table->id(); // Changed from Id to id
            $table->string('code')->unique(); // Added unique constraint assumption
            $table->string('fichier')->nullable(); // File path, maybe nullable?
            $table->string('classification_prov')->nullable();
            $table->string('categorie')->nullable();
            $table->text('intitule'); // Use text for potentially long strings
            $table->string('reference')->nullable();
            $table->string('convention_signee_par')->nullable();
            $table->year('annee_convention')->index(); // Use year type, add index
            $table->text('objet')->nullable();
            $table->text('objectifs')->nullable();
            $table->string('localisation')->nullable();
            $table->string('maitre_ouvrage')->nullable()->index(); // Add index
            $table->string('partenaire'); // Store IDs like "1;5;12" - consider a pivot table instead long-term
            $table->decimal('cout_global', 15, 2)->default(0); // Use DECIMAL for currency
            $table->decimal('cout_cr', 15, 2)->default(0); // Use DECIMAL for currency
            $table->string('statut')->nullable()->index(); // Add index
            $table->string('operationalisation')->nullable();
            $table->foreignId('id_programme')->constrained('programmes')->cascadeOnDelete();
            $table->string('groupe')->nullable();
            $table->integer('rang')->nullable(); // Use integer for rank
            $table->timestamps();
        });

        Schema::create('convention_partenaires', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_convention')->constrained('conventions')->cascadeOnDelete(); // References PLURAL
            $table->foreignId('id_partenaire')->constrained('partenaires')->cascadeOnDelete();
            $table->decimal('montant_convenu', 15, 2)->default(0); // Use DECIMAL
            $table->timestamps();
            $table->unique(['id_convention', 'id_partenaire']); // Prevent duplicates
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->id(); // Changed from Id to id
            $table->foreignId('id_conv')->constrained('conventions')->cascadeOnDelete(); // References PLURAL
            $table->string('intitule');
            $table->string('file_path')->nullable(); // Added for storing actual file path
            $table->string('file_name')->nullable(); // Added for storing original file name
            $table->string('Type')->nullable(); // Mime type?
            $table->timestamps();
        });

        Schema::create('engagements', function (Blueprint $table) {
            $table->id(); // Changed from Id to id
            $table->string('code_engag')->unique(); // Added unique constraint assumption
            $table->string('description');
            $table->decimal('cout', 15, 2)->default(0); // Use DECIMAL
            $table->decimal('montant_cro', 15, 2)->default(0); // Use DECIMAL
            $table->decimal('montant_hors_cro', 15, 2)->default(0); // Use DECIMAL
            $table->integer('rang')->nullable(); // Use integer
            $table->foreignId('id_programme')->constrained('programmes')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('engage_parts', function (Blueprint $table) {
            $table->id(); // Changed from Id to id
            $table->foreignId('id_engagement')->constrained('engagements')->cascadeOnDelete();
            $table->foreignId('id_partenaire')->constrained('partenaires')->cascadeOnDelete();
            $table->decimal('montant_engage', 15, 2)->default(0); // Use DECIMAL
            $table->date('date')->nullable(); // Use DATE type
            $table->decimal('montant_effectif', 15, 2)->default(0)->nullable(); // Use DECIMAL
            $table->timestamps();
        });

        // This table seems redundant with convention_partenaires? Review if needed.
        Schema::create('montant_engages', function (Blueprint $table) {
            $table->id(); // Changed from Id to id
            $table->foreignId('id_convention')->constrained('conventions')->cascadeOnDelete(); // References PLURAL
            $table->foreignId('id_partenaire')->constrained('partenaires')->cascadeOnDelete();
            $table->decimal('montant_engage', 15, 2)->default(0); // Use DECIMAL
            $table->date('date')->nullable(); // Use DATE type
            $table->timestamps();
            $table->unique(['id_convention', 'id_partenaire', 'date']); // Example unique constraint
        });

        Schema::create('projets', function (Blueprint $table) {
            $table->id(); // Changed from Id to id
            $table->string('code_projet')->unique(); // Added unique constraint assumption
            $table->string('nom_projet');
            $table->foreignId('id_domaine')->constrained('domaines')->cascadeOnDelete();
            $table->foreignId('id_programme')->constrained('programmes')->cascadeOnDelete();
            $table->foreignId('id_chantier')->constrained('chantiers')->cascadeOnDelete();
            $table->decimal('cout_projet', 15, 2)->default(0); // Use DECIMAL
            $table->decimal('cout_cro', 15, 2)->default(0)->nullable(); // Use DECIMAL
            $table->date('date_debut')->nullable(); // Use DATE
            $table->date('date_fin')->nullable(); // Use DATE
            $table->text('observations')->nullable();
            $table->string('etat_avan_physi')->nullable();
            $table->string('etat_avan_finan')->nullable();
            $table->string('convention_code')->nullable()->index(); // Reference code, add index
            $table->timestamps();
        });

        Schema::create('projet_partenaires', function (Blueprint $table) {
            $table->id(); // Changed from Id to id
            $table->foreignId('id_projet')->constrained('projets')->cascadeOnDelete();
            $table->foreignId('id_partenaire')->constrained('partenaires')->cascadeOnDelete();
            $table->decimal('montant', 15, 2)->default(0); // Use DECIMAL
            $table->string('type_engagement')->nullable();
            $table->timestamps();
        });

        Schema::create('sous_projets', function (Blueprint $table) {
            $table->id(); // Changed from Id to id
            $table->string('code_sous_projet')->unique(); // Added unique constraint assumption
            $table->string('id_projet_maitre')->index(); // Assuming this references projet.code_projet? Needs review.
            // Consider: $table->foreignId('id_projet')->constrained('projets'); if it's the ID
            $table->string('nom_projet');
            $table->foreignId('id_province')->constrained('provinces')->cascadeOnDelete();
            $table->foreignId('id_commune')->constrained('communes')->cascadeOnDelete();
            $table->text('observations')->nullable();
            $table->string('etat_avan_physi')->nullable();
            $table->string('etat_avan_finan')->nullable();
            $table->decimal('estim_initi', 15, 2)->default(0)->nullable(); // Use DECIMAL
            $table->string('secteur')->nullable();
            $table->string('localite')->nullable();
            $table->string('centre')->nullable();
            $table->string('site')->nullable();
            $table->string('surface')->nullable();
            $table->string('lineaire')->nullable();
            $table->string('status')->nullable()->index();
            $table->text('douars_desservis')->nullable();
            $table->string('financement')->nullable();
            $table->string('nature_intervention')->nullable();
            $table->string('benificiaire')->nullable();
            $table->timestamps();
        });

        // --- Spatie Permissions Tables ---
        $tableNames = config('permission.table_names');
        $columnNames = config('permission.column_names');
        $teams = config('permission.teams');

        if (empty($tableNames)) {
            throw new \Exception('Error: config/permission.php not loaded. Run [php artisan config:clear] and try again.');
        }

        Schema::create($tableNames['permissions'], function (Blueprint $table) {
            $table->id(); // permission id
            $table->string('name');       // For querying permission name
            $table->string('guard_name'); // Scope permission to guard
            $table->timestamps();
            $table->unique(['name', 'guard_name']);
        });

        Schema::create($tableNames['roles'], function (Blueprint $table) use ($teams) {
            $table->id(); // role id
            if ($teams) { // permission.teams is configured
                $table->unsignedBigInteger(config('permission.column_names.team_foreign_key'));
                $table->index(config('permission.column_names.team_foreign_key'), 'roles_team_foreign_key_index');
            }
            $table->string('name');       // For querying role name
            $table->string('guard_name'); // Scope role to guard
            $table->timestamps();
            if ($teams) {
                $table->unique([config('permission.column_names.team_foreign_key'), 'name', 'guard_name']);
            } else {
                $table->unique(['name', 'guard_name']);
            }
        });

        Schema::create($tableNames['model_has_permissions'], function (Blueprint $table) use ($tableNames, $columnNames) {
            $table->unsignedBigInteger(config('permission.column_names.permission_pivot_key', 'permission_id'));
            $table->string('model_type');
            $table->unsignedBigInteger($columnNames['model_morph_key']);
            $table->index([$columnNames['model_morph_key'], 'model_type'], 'model_has_permissions_model_id_model_type_index');
            $table->foreign(config('permission.column_names.permission_pivot_key', 'permission_id'))
                ->references('id') // permission id
                ->on($tableNames['permissions'])
                ->onDelete('cascade');
            $table->primary(
                [config('permission.column_names.permission_pivot_key', 'permission_id'), $columnNames['model_morph_key'], 'model_type'],
                'model_has_permissions_permission_model_type_primary'
            );
        });

        Schema::create($tableNames['model_has_roles'], function (Blueprint $table) use ($tableNames, $columnNames, $teams) {
            $table->unsignedBigInteger(config('permission.column_names.role_pivot_key', 'role_id'));
            $table->string('model_type');
            $table->unsignedBigInteger($columnNames['model_morph_key']);
            $table->index([$columnNames['model_morph_key'], 'model_type'], 'model_has_roles_model_id_model_type_index');
            $table->foreign(config('permission.column_names.role_pivot_key', 'role_id'))
                ->references('id') // role id
                ->on($tableNames['roles'])
                ->onDelete('cascade');
            if ($teams) {
                $table->primary(
                    [config('permission.column_names.team_foreign_key'), config('permission.column_names.role_pivot_key', 'role_id'), $columnNames['model_morph_key'], 'model_type'],
                    'model_has_roles_role_model_type_primary'
                );
            } else {
                $table->primary(
                    [config('permission.column_names.role_pivot_key', 'role_id'), $columnNames['model_morph_key'], 'model_type'],
                    'model_has_roles_role_model_type_primary'
                );
            }
        });

        Schema::create($tableNames['role_has_permissions'], function (Blueprint $table) use ($tableNames) {
            $table->unsignedBigInteger(config('permission.column_names.permission_pivot_key', 'permission_id'));
            $table->unsignedBigInteger(config('permission.column_names.role_pivot_key', 'role_id'));
            $table->foreign(config('permission.column_names.permission_pivot_key', 'permission_id'))
                ->references('id') // permission id
                ->on($tableNames['permissions'])
                ->onDelete('cascade');
            $table->foreign(config('permission.column_names.role_pivot_key', 'role_id'))
                ->references('id') // role id
                ->on($tableNames['roles'])
                ->onDelete('cascade');
            $table->primary(
                [config('permission.column_names.permission_pivot_key', 'permission_id'), config('permission.column_names.role_pivot_key', 'role_id')],
                'role_has_permissions_permission_id_role_id_primary'
            );
        });

        app('cache')
            ->store(config('permission.cache.store') != 'default' ? config('permission.cache.store') : null)
            ->forget(config('permission.cache.key'));


        // --- Sanctum Table ---
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable'); // Uses model_type and model_id convention
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        // --- Cache Tables (for Database Driver) ---
        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->integer('expiration');
        });

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->integer('expiration');
        });
    }

    /**
     * Reverse the migrations.
     * Drop tables in reverse order of creation.
     */
    public function down(): void
    {
        // --- Safely Drop Tables ---
        // Option: Use Foreign Key Check disable/enable if order is complex
        // DB::statement('SET FOREIGN_KEY_CHECKS=0;');

        Schema::dropIfExists('cache_locks');
        Schema::dropIfExists('cache');
        Schema::dropIfExists('personal_access_tokens');

        // Drop Spatie tables using config names
        $tableNames = config('permission.table_names');
        if (!empty($tableNames)) { // Check config loaded
            Schema::dropIfExists($tableNames['role_has_permissions']);
            Schema::dropIfExists($tableNames['model_has_roles']);
            Schema::dropIfExists($tableNames['model_has_permissions']);
            Schema::dropIfExists($tableNames['roles']);
            Schema::dropIfExists($tableNames['permissions']);
        } else { // Fallback if config fails during rollback
             Schema::dropIfExists('role_has_permissions');
             Schema::dropIfExists('model_has_roles');
             Schema::dropIfExists('model_has_permissions');
             Schema::dropIfExists('roles');
             Schema::dropIfExists('permissions');
        }


        // Drop Application Tables in reverse order
        Schema::dropIfExists('sous_projets');
        Schema::dropIfExists('projet_partenaires');
        Schema::dropIfExists('projets');
        Schema::dropIfExists('montant_engages');
        Schema::dropIfExists('engage_parts');
        Schema::dropIfExists('engagements');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('convention_partenaires');
        Schema::dropIfExists('conventions'); // Drop PLURAL name
        Schema::dropIfExists('utilisateurs');
        Schema::dropIfExists('provinces');
        Schema::dropIfExists('communes');
        Schema::dropIfExists('partenaires');
        Schema::dropIfExists('programmes');
        Schema::dropIfExists('chantiers');
        Schema::dropIfExists('domaines');

        // DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }
};