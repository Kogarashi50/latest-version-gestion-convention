<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Commune extends Model
{
    protected $table = 'commune';
    protected $fillable = [ 'Id','Code',             
    'Description',   
    'Description_Arr'];
    public $timestamps=true;
}
