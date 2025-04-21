<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Chantier;

class Programme extends Model
{
    protected $table = "programme";
    protected $fillable = [
        'Id',
        'Description',
        'Code_Programme',
        'Id_Chantier',
    ];
    public function chantier()
    {
        return $this->belongsTo(Chantier::class, 'Id_Chantier', 'Code_Chantier');
    }
}

