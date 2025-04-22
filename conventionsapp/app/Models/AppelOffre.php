<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo; // Import the BelongsTo relationship type

/**
 * App\Models\AppelOffre
 *
 * Represents an 'appel_offre' (Call for Tender) record in the database.
 *
 * @property int $id
 * @property string $categorie Type of tender (Travaux, Etudes, Services, Fournitures)
 * @property int|null $province_id Foreign key referencing the province
 * @property string $numero Unique tender reference number
 * @property string $intitule Title/Subject of the tender
 * @property float|null $estimation Total estimated cost (TTC?) - nullable
 * @property float $estimation_HT Estimated cost before tax (HT)
 * @property float $montant_TVA Calculated VAT amount
 * @property int|null $duree_execution Duration in days
 * @property \Illuminate\Support\Carbon|null $date_verification Verification date
 * @property \Illuminate\Support\Carbon|null $date_ouverture Bid opening date
 * @property \Illuminate\Support\Carbon|null $last_session_op Date of the last bid opening session
 * @property bool $lancement_portail Flag indicating if published on portal
 * @property \Illuminate\Support\Carbon|null $date_lancement_portail Date published on portal
 * @property \Illuminate\Support\Carbon|null $created_at Timestamp of creation
 * @property \Illuminate\Support\Carbon|null $updated_at Timestamp of last update
 *
 * @property-read \App\Models\Province|null $province The province associated with this tender.
 */
class AppelOffre extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'appel_offre';

    /**
     * Indicates if the model should be timestamped.
     * (Handled automatically by Laravel if created_at/updated_at columns exist)
     *
     * @var bool
     */
    public $timestamps = true; // Schema has created_at and updated_at

    /**
     * The attributes that are mass assignable.
     * These are the fields that can be filled using AppelOffre::create([...]) or $appelOffre->fill([...])
     * Excludes id, created_at, updated_at which are typically handled automatically.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'categorie',
        'province_id',
        'numero',
        'intitule',
        'estimation',
        'estimation_HT',
        'montant_TVA',
        'duree_execution',
        'date_verification',
        'date_ouverture',
        'last_session_op',
        'lancement_portail',
        'date_lancement_portail',
    ];

    /**
     * The attributes that should be cast to native types.
     * Improves data handling and consistency.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'estimation' => 'decimal:2', // Cast decimal with 2 places
        'estimation_HT' => 'decimal:2',
        'montant_TVA' => 'decimal:2',
        'duree_execution' => 'integer',
        'date_verification' => 'date:Y-m-d', // Cast to Carbon date object (YYYY-MM-DD)
        'date_ouverture' => 'date:Y-m-d',
        'last_session_op' => 'date:Y-m-d',
        'lancement_portail' => 'boolean', // Cast to boolean (true/false)
        'date_lancement_portail' => 'date:Y-m-d',
        // 'created_at' and 'updated_at' are automatically handled as Carbon instances by Laravel
        // 'categorie' is an ENUM, typically handled as a string in PHP/Eloquent
    ];

    // --- Relationships ---

    /**
     * Get the Province that this AppelOffre belongs to.
     * Defines the inverse of a one-to-many relationship.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function province(): BelongsTo
    {
        // Assuming the Province model exists at App\Models\Province
        // Foreign key on appel_offre table: 'province_id' (matches convention)
        // Owner key (Primary Key) on province table: 'Id' (based on your Province model example)
        return $this->belongsTo(Province::class, 'province_id', 'Id');
    }
}