<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany; // <-- Import HasMany

class Partenaire extends Model
{
    protected $table = 'partenaire';

    // **Specify the correct Primary Key if it's not 'id'**
    protected $primaryKey = 'Id';

    // **Specify if the primary key is not auto-incrementing (usually it is)**
    // public $incrementing = false;

    // **Specify the type if the primary key is not an integer**
    // protected $keyType = 'string';

    protected $fillable = [
        // 'Id', // <-- Remove Primary Key from fillable
        'Code',
        'Description',
        'Description_Arr'
    ];

    public $timestamps = true; // Assumes you have created_at and updated_at columns

    /**
     * Relationship to Conventions (Many-to-Many)
     */
    public function conventions(): BelongsToMany
    {
        return $this->belongsToMany(Convention::class, 'convention_partenaire', 'Id_Partenaire', 'Id_Convention')
                     ->withPivot(['Montant_Convenu', 'is_signatory', 'date_signature', 'details_signature'])
                     ->withTimestamps();
    }

    /**
     * Relationship to Avenants (Many-to-Many)
     */
    public function avenants(): BelongsToMany
    {
        return $this->belongsToMany(Avenant::class, 'avenant_partenaire', 'partenaire_id', 'avenant_id');
        // Add ->withTimestamps() if pivot table has them
    }

    /**
     * Relationship to EngagementsFinanciers (One-to-Many)
     * A Partner can have multiple financial engagements.
     */
    public function engagementsFinanciers(): HasMany
    {
        // Assumes the foreign key in the 'engagements_financiers' table is 'partenaire_id'
        // Assumes the local key on the 'partenaire' table is 'Id' (defined above)
        return $this->hasMany(EngagementFinancier::class, 'partenaire_id', 'Id');
    }
}