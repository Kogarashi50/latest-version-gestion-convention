<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Domaine extends Model
{
    protected $table ='domaine';
    protected $fillable = [ 'Id','Code',             
    'Description',   
    'Description_Arr'];
    public $timestamps=true;
}
