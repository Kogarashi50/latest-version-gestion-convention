<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarchePublic extends Model
{
    use HasFactory; // Enables factory usage

    /**
     * The table associated with the model.
     * Explicitly defining is good practice.
     *
     * @var string
     */
    protected $table = 'marche_public';

    /**
     * Indicates if the model should be timestamped.
     * Laravel assumes true by default if 'created_at' and 'updated_at' columns exist.
     *
     * @var bool
     */
    // public $timestamps = true; // Default is true, uncomment if needed explicitly

    /**
     * The attributes that are mass assignable.
     * Protects against mass assignment vulnerabilities.
     * List all columns you want to allow filling via ::create() or ::update().
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'numero_marche',
        'intitule',
        'type_marche',
        'procedure_passation',
        'mode_passation',
        'budget_previsionnel',
        'montant_attribue',
        'source_financement',
        'attributaire',
        'date_publication',
        'date_limite_offres',
        'date_notification',
        'date_debut_execution',
        'duree_marche',
        'statut',
        'id_convention',
    ];

    /**
     * The attributes that should be cast.
     * Ensures data is treated as the correct type.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'budget_previsionnel' => 'decimal:2', // Casts to float/string formatted to 2 decimals on retrieval
        'montant_attribue' => 'decimal:2',
        'date_publication' => 'date:Y-m-d', // Casts to Carbon date object, formats to Y-m-d on serialization
        'date_limite_offres' => 'date:Y-m-d',
        'date_notification' => 'date:Y-m-d',
        'date_debut_execution' => 'date:Y-m-d',
        'duree_marche' => 'integer',
        // Timestamps are automatically handled if columns exist and $timestamps isn't false
        // 'created_at' => 'datetime',
        // 'updated_at' => 'datetime',
    ];

    // --- Relationships ---

    /**
     * Get the lots associated with this public market.
     * Defines a one-to-many relationship.
     */
    public function lots(): HasMany
    {
        // Assumes 'marche_id' foreign key on 'lot' table and 'id' primary key on 'marche_public' table
        return $this->hasMany(Lot::class, 'marche_id', 'id');
    }

    /**
     * Get the general files directly associated with this public market (not linked to a specific lot).
     * Defines a one-to-many relationship, filtered.
     */
    public function fichiersJointsGeneraux(): HasMany
    {
        // Assumes 'marche_id' foreign key on 'fichier_joint' table and 'id' primary key on 'marche_public'
        return $this->hasMany(FichierJoint::class, 'marche_id', 'id')
                    ->whereNull('lot_id'); // Filter for files where lot_id IS NULL
    }

     /**
      * Get ALL files associated with this public market, whether general or linked to one of its lots.
      * Note: This might be less efficient than fetching separately. Often used for checks.
      */
     public function tousFichiersJoints(): HasMany
     {
         // A simple relationship based on marche_id - won't get files *only* linked to lots if marche_id is null on those files.
         // To get truly ALL files, you might need a more complex query or fetch via lots relationship.
         // This defines files directly linked to the market:
         return $this->hasMany(FichierJoint::class, 'marche_id', 'id');
         // Fetching $marche->load('lots.fichiersJoints', 'fichiersJointsGeneraux') is often clearer.
     }
     public function convention()
     {
         // Assumes Convention model exists and foreign key is id_convention
         return $this->belongsTo(Convention::class,'id_convention', 'id');
     }
}