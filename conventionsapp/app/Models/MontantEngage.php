<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MontantEngage extends Model
{
    protected $fillable = [
        'id_convention',
        'id_partenaire',
        'montant_engage',
        'date',
        'parcourir',
        'structure',
        'rechercher',
        'inserer',
        'vider',
        'supprimer',
        'type',
        'interclassement',
        'taille',
        'perte',
    ];
}
