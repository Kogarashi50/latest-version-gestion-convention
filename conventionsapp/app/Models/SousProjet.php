<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SousProjet extends Model
{
    protected $table ='sous_projet';
 // app/Models/SousProjet.php
protected $fillable = [
    'Code_Sous_Projet', // Make sure this matches EXACTLY
    'Nom_Projet',
    'ID_Projet_Maitre',
    'Id_Province',
    'Id_Commune',
    'Observations',
    'Etat_Avan_Physi',
    'Etat_Avan_Finan',
    'Estim_Initi',
    'Secteur',
    'Localite',
    'Centre',
    'Site',
    'Surface',
    'Lineaire',
    'Status',
    'Douars_Desservis',
    'Financement',
    'Nature_Intervention',
    'Benificiaire',
    // Add any others if necessary, remove if not needed
];
    public function projet()
    {
        return $this->belongsTo(Projet::class, 'ID_Projet_Maitre', 'Code_Projet');

    }

  
    public function province()
    {
        return $this->belongsTo(Province::class, 'Id_Province', 'Id');
    }

 
    public function commune()
    {
        return $this->belongsTo(Commune::class, 'Id_Commune', 'Id');
     
    }



}
