<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Chantier extends Model
{
    
    protected $table = "chantier";
    protected $fillable = [
    'Id',
        'Description',
        'Code_Chantier',
        'Id_Domaine',
    ];
    public function domaine()
    {
        return $this->belongsTo(Domaine::class, 'Id_Domaine', 'Code');
    }
}
