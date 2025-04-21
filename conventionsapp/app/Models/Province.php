<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Province extends Model
{
    protected $table ='province';
    protected $fillable = [
       'Id',
       'Code',             
    'Description',   
    'Description_Arr'];
    public $timestamps=true;
}
