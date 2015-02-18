/**
 * 
 */
// GLSL ES code to be compiled as vertex shader
/*
vertexShaderCode=
'attribute vec3 ppos;'+
'attribute vec4 pcolor;'+
'varying mediump vec4 forward_color;'+
'uniform mat4 mvp;'+
'void main(void) {'+
'  gl_Position = mvp * vec4(ppos.x, ppos.y, ppos.z, 1.0);'+
'  gl_PointSize = 2.0;'+  // Inserted in part 6
'  forward_color = pcolor;'+
'}';
*/
vertexShaderCode=
'attribute vec3 ppos;'+
'attribute vec2 aTexCo;'+
'varying highp vec2 vTexCo;'+
'uniform mat4 mvp;'+
'void main(void) {'+
'  gl_Position = mvp * vec4(ppos.x, ppos.y, ppos.z, 1.0);'+
'  gl_PointSize = 2.0;'+ 
'  vTexCo = aTexCo;'+
'}';

// GLSL ES code to be compiled as fragment shader
/*
fragmentShaderCode=
'varying mediump vec4 forward_color;'+
'void main(void) {'+
'  gl_FragColor = forward_color;'+
'}';
*/
fragmentShaderCode=
'varying highp vec2 vTexCo;'+
'uniform sampler2D uSampler;'+
'void main(void) {'+
'  gl_FragColor = texture2D(uSampler, vec2(vTexCo.s,vTexCo.t));'+
'}';

// Global variables
//-----------------
var gl = null;       // GL context
var program;         // The program object used in the GL context
var running = true;  // True when the canvas is periodically refreshed
var aspectRatio;     // Aspect ratio of the canvas used to correct the X/Y distortion 
var vertices;        // Vertices of the object 
var colors;          // Colors of the object 
var texcoords;		// texture coords of the object
var mdown = false;
var oldx = -1, oldy = -1;
var textureId;

var xsize=8; //16;
var ysize=3200; //1600; // should be power of two but breaks things 

var texture1 = new Uint8Array(xsize*ysize*4);
var texture2 = new Uint8Array(xsize*ysize*4);

var starty = 10;
var damnspoty = starty;
var damnspotx = 0;

var current_tx=0;

// Function called by onload handler
function start()
{
  // Gets canvas from the HTML page
  var canvas = document.getElementById('glcanvas');

  // Creates GL context
  try {gl = canvas.getContext('experimental-webgl');}
  catch(e) {alert('Exception catched in getContext: '+e.toString());return;}
  
  // If no exception but context creation failed, alerts user
  if(!gl) {alert('Unable to create Web GL context');return;}
  
  // Creates fragment shader 
  var fshader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fshader, fragmentShaderCode);
  gl.compileShader(fshader);
  if (!gl.getShaderParameter(fshader, gl.COMPILE_STATUS)) 
  {alert('Error during fragment shader compilation:\n' + gl.getShaderInfoLog(fshader)); return;}

  // Creates vertex shader (converts 2D point position to coordinates)
  var vshader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vshader, vertexShaderCode);
  gl.compileShader(vshader);
  if (!gl.getShaderParameter(vshader, gl.COMPILE_STATUS)) 
  {alert('Error during vertex shader compilation:\n' + gl.getShaderInfoLog(vshader)); return;}

  // Creates program and links shaders to it
  program = gl.createProgram();
  gl.attachShader(program, fshader);
  gl.attachShader(program, vshader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) 
  {alert('Error during program linking:\n' + gl.getProgramInfoLog(program));return;}

  // Validates and uses program in the GL context
  gl.validateProgram(program);
  if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) 
  {alert('Error during program validation:\n' + gl.getProgramInfoLog(program));return;}
  gl.useProgram(program);



  create_texture();

  updateObject();
   
  // Determination of the aspect ratio
  aspectRatio = canvas.width / canvas.height;
  
  // The function draw() will be called every 20 ms
  setInterval("draw();", 20);
  setInterval("generate();", 500);  
}

// Updates object with global parameters
function updateObject()
{ 
  // Gets the torus factor from the HTML page
  var interleave = parseFloat(document.getElementById('interleave').value);
  var numsegs = parseFloat(document.getElementById('numsegs').value);
  var numssegs = parseFloat(document.getElementById('numssegs').value);
  var sradius = parseFloat(document.getElementById('sradius').value);
  var bradius = parseFloat(document.getElementById('bradius').value);

  var obj = makeTorus(bradius, sradius, numsegs, numssegs, interleave);
  vertices = obj.vertices;
  colors = obj.colors;
  texcoords = obj.texcoords;

  
  // Gets address of the input 'attribute' of the vertex shader
  var vattrib = gl.getAttribLocation(program, 'ppos');
  if(vattrib == -1)
   {alert('Error during attribute address retrieval');return;}
  gl.enableVertexAttribArray(vattrib);

  var texcoAttrib = gl.getAttribLocation(program, 'aTexCo');
  if(texcoAttrib == -1)
   {alert('Error during attribute address retrieval');return;}
  gl.enableVertexAttribArray(texcoAttrib);

  // Initializes the vertex buffer and sets it as current one
  var vbuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbuffer);

  // Puts vertices to buffer and links it to attribute variable 'ppos'
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.vertexAttribPointer(vattrib, 3, gl.FLOAT, false, 0, 0);
  
  /*
  // Connects colors array to vertex shader via the 'pcolor' attribute 
  var cattrib = gl.getAttribLocation(program, 'pcolor');
  if(cattrib == -1){alert('Error retrieving pcolor address');return;}
  gl.enableVertexAttribArray(cattrib);
  var cbuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cbuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  gl.vertexAttribPointer(cattrib, 4, gl.FLOAT, false, 0, 0);
  */
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, textureId);
  gl.uniform1i(gl.getUniformLocation(program, "uSampler"), 0);
  var tbuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tbuffer);
  gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
  gl.vertexAttribPointer(texcoAttrib, 2, gl.FLOAT, false, 0, 0);
  
}

// Function called periodically to breed next gen
function generate()
{
	if(current_tx == 0)
	{
		current_tx = 1;
		select_texture(1);
	}
	else
	{
		if(current_tx == 1)
		{
			current_tx = 2
			next_gen( 1, 2 );
			select_texture(2);
		}
		else
		{
			current_tx = 1
			next_gen( 2, 1 );
			select_texture(1);
		}
	}
}

// Function called periodically to draw the scene
function draw()
{
  // Tests if canvas should be refreshed
  if(!running || !gl)
    return;

    
  // Gets control value angles from HTML page via DOM
  var ax = parseInt(document.getElementById('ax').innerText, 10);
  var ay = parseInt(document.getElementById('ay').innerText, 10);
  var az = parseInt(document.getElementById('az').innerText, 10);
  
  // Use increments via DOM to update angles (still in degrees)
  ax = (ax + parseInt(document.getElementById('dx').value, 10) + 360) % 360;
  ay = (ay + parseInt(document.getElementById('dy').value, 10) + 360) % 360;
  az = (az + parseInt(document.getElementById('dz').value, 10) + 360) % 360;
  
  // Update HTML page with new values
  document.getElementById('ax').innerText = ax.toString();
  document.getElementById('ay').innerText = ay.toString();
  document.getElementById('az').innerText = az.toString();
  
  // Convert values to radians
  ax *= 2*Math.PI/360; ay *= 2*Math.PI/360; az *= 2*Math.PI/360; 

  // Gets ox, oy, oz, s, d from the HTML form
  var ox = parseFloat(document.getElementById('ox').value);
  var oy = parseFloat(document.getElementById('oy').value);
  var oz = parseFloat(document.getElementById('oz').value);
  var s = parseFloat(document.getElementById('s').value);
  var d = parseFloat(document.getElementById('d').value);
  var f = parseFloat(document.getElementById('f').value);
  var n = parseFloat(document.getElementById('n').value);
  var exz = document.getElementById('exz').checked;

  // Gets reference on the "uniform" 4x4 matrix transforming coordinates
  var amvp = gl.getUniformLocation(program, "mvp");
  if(amvp == -1)
  {alert('Error during uniform address retrieval');running=false;return;}  

  // Creates matrix using rotation angles
  var mat = getTransformationMatrix(ox, oy, oz, ax, ay, az, s, d, f, n, aspectRatio, exz);
  
  // Sets the model-view-projections matrix in the shader
  gl.uniformMatrix4fv(amvp, false, mat);

  // Sets clear color to non-transparent dark blue and clears context
  gl.clearColor(0.0, 0.0, 0.5, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Enables Z-Buffering
  gl.enable(gl.DEPTH_TEST);

  // Gets rendering parameter(s) from the HTML page
  var rendering = document.getElementById('rendering').value;
  var glrender = window.eval('gl.'+rendering);

  // Draws the object
  gl.drawArrays(glrender, 0, vertices.length/3);
  gl.flush();
}

// Returns a transformation matrix as a flat array with 16 components, given:
// ox, oy, oz: new origin (translation)
// rx, ry, rz: rotation angles (radians)
// s: scaling factor
// d: distance between camera and origin after translation,
//     if d <= -n skips projection completely
// f: z coordinate of far plane (normally positive)
// n: z coordinate of near plane (normally negative)
// ar: aspect ratio of the viewport (e.g. 16/9)
// exz: if true exchanges X and Z coords after projection
function getTransformationMatrix(ox, oy, oz, rx, ry, rz, s, d, f, n, ar, exz)
{
  // Pre-computes trigonometric values
  var cx = Math.cos(rx), sx = Math.sin(rx);
  var cy = Math.cos(ry), sy = Math.sin(ry);
  var cz = Math.cos(rz), sz = Math.sin(rz);

  // Tests if d is too small, hence making perspective projection not possible
  if (d <= -n)
  {
    // Transformation matrix without projection
    return new Float32Array([
      (cy*cz*s)/ar,cy*s*sz,-s*sy,0,
      (s*(cz*sx*sy-cx*sz))/ar,s*(sx*sy*sz+cx*cz),cy*s*sx,0,
      (s*(sx*sz+cx*cz*sy))/ar,s*(cx*sy*sz-cz*sx),cx*cy*s,0,
      (s*(cz*((-oy*sx-cx*oz)*sy-cy*ox)-(oz*sx-cx*oy)*sz))/ar,
      s*(((-oy*sx-cx*oz)*sy-cy*ox)*sz+cz*(oz*sx-cx*oy)),
      s*(ox*sy+cy*(-oy*sx-cx*oz)),1    
    ]);
  }
  else
  {
    // Pre-computes values determined with wxMaxima
    var A=d;
    var B=(n+f+2*d)/(f-n);
    var C=-(d*(2*n+2*f)+2*f*n+2*d*d)/(f-n);
    
    // Tests if X and Z must be exchanged
    if(!exz)
    {
      // Full transformation matrix
      return new Float32Array([
        (cy*cz*s*A)/ar,cy*s*sz*A,-s*sy*B,-s*sy,
        (s*(cz*sx*sy-cx*sz)*A)/ar,s*(sx*sy*sz+cx*cz)*A,cy*s*sx*B,cy*s*sx,
        (s*(sx*sz+cx*cz*sy)*A)/ar,s*(cx*sy*sz-cz*sx)*A,cx*cy*s*B,cx*cy*s,
        (s*(cz*((-oy*sx-cx*oz)*sy-cy*ox)-(oz*sx-cx*oy)*sz)*A)/ar,
        s*(((-oy*sx-cx*oz)*sy-cy*ox)*sz+cz*(oz*sx-cx*oy))*A,
        C+(s*(ox*sy+cy*(-oy*sx-cx*oz))+d)*B,s*(ox*sy+cy*(-oy*sx-cx*oz))+d
      ]);
    }
    else
    {
      // Full transformation matrix with XZ exchange
      return new Float32Array([
        -s*sy*B,cy*s*sz*A,(cy*cz*s*A)/ar,-s*sy,
        cy*s*sx*B,s*(sx*sy*sz+cx*cz)*A,(s*(cz*sx*sy-cx*sz)*A)/ar,cy*s*sx,
        cx*cy*s*B,s*(cx*sy*sz-cz*sx)*A,(s*(sx*sz+cx*cz*sy)*A)/ar,cx*cy*s,
        C+(s*(ox*sy+cy*(-oy*sx-cx*oz))+d)*B,s*(((-oy*sx-cx*oz)*sy-cy*ox)*sz+cz*(oz*sx-cx*oy))*A,
        (s*(cz*((-oy*sx-cx*oz)*sy-cy*ox)-(oz*sx-cx*oy)*sz)*A)/ar,s*(ox*sy+cy*(-oy*sx-cx*oz))+d
      ]);
    }
  }
}

// Creates a 3D torus in the XY plane, returns the data in a new object composed of
//   several Float32Array objects named 'vertices' and 'colors', according to
//   the following parameters:
// r:  big radius
// sr: section radius
// n:  number of faces
// sn: number of faces on section
// k:  factor between 0 and 1 defining the space between strips of the torus
function makeTorus(r, sr, n, sn, k)
{
  // Temporary arrays for the vertices, normals and colors
  var tv = new Array();
  var tc = new Array();
  var tt = new Array();
  
  // Iterates along the big circle and then around a section
  for(var i=0;i<n;i++)               // Iterates over all strip rounds
    for(var j=0;j<sn+1*(i==n-1);j++) // Iterates along the torus section
      for(var v=0;v<2;v++)           // Creates zigzag pattern (v equals 0 or 1)
      {
        // Pre-calculation of angles
        var a =  2*Math.PI*(i+j/sn+k*v)/n;
        var sa = 2*Math.PI*j/sn;
        var x, y, z;
        var texu,texv;
      
        // Coordinates on the surface of the torus  
        tv.push(x = (r+sr*Math.cos(sa))*Math.cos(a)); // X
        tv.push(y = (r+sr*Math.cos(sa))*Math.sin(a)); // Y
        tv.push(z = sr*Math.sin(sa));                 // Z
      
        // Colors
        tc.push(0.5+0.5*x);  // R
        tc.push(0.5+0.5*y); // G
        tc.push(0.5+0.5*z);  // B
        tc.push(1.0);  // Alpha
        
        // need tex corrds here??
        tt.push(texu=v);
        tt.push(texv=(i*sn+j)/(n*sn));
      }

  // Converts and returns array
  var res = new Object();
  res.vertices = new Float32Array(tv);
  res.colors = new Float32Array(tc);
  res.texcoords = new Float32Array(tt);
  return res;
}

function mousing()
{
   var e = window.event;

    var posX = e.clientX;
    var posY = e.clientY;

	
    document.Form1.posx.value = posX;
    document.Form1.posy.value = posY;
    document.Form1.mdown.value = mdown;

	if(!mdown) return;

  
	if( oldx == -1 )
	{
		oldx = posX;
		oldy = posY;
		return;
	}    
	// Gets control value angles from HTML page via DOM
  	var ax = parseInt(document.getElementById('ax').innerText, 10);
  	var ay = parseInt(document.getElementById('ay').innerText, 10);
  
  	ax = (ax + (oldy-posY) + 360) % 360;
  	ay = (ay + (oldx-posX) + 360) % 360;
  
  	// Update HTML page with new values
  	document.getElementById('ax').innerText = ax.toString();
  	document.getElementById('ay').innerText = ay.toString();

	oldx = posX;
	oldy = posY;
  
}

function select_texture(tx)
{
	if(tx ==1 )
	{			
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, xsize, ysize, 0, gl.RGBA, gl.UNSIGNED_BYTE, texture1);
	}
	else
	{
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, xsize, ysize, 0, gl.RGBA, gl.UNSIGNED_BYTE, texture2);
	}
}

function write_texture( tx, j, i, set)
{
	set_cell(tx,j,i,set);
	select_texture(tx);
}

function fill_texture(tx)
{
	var i,j;

	for(i=0;i<ysize;i++)
	{
		for(j=0;j<xsize;j++)
		{
			set_cell(tx,j,i,0);
		}
	}
}

function get_cell(tx,x,y)
{
	var state=0;
	var numssegs = parseFloat(document.getElementById('numssegs').value);
	
	if(x < 0)
	{
		x = x+xsize;
		y = y-ysize/numssegs;
		if(y<0)
		{
			y = y + ysize;
		}
	}
	if(x >= xsize)
	{
		x = x -xsize;
		y = y + ysize/numssegs;
		if( y > ysize)
		{
			y = y - ysize;
		}
	}
	if( y < 0 )
	{
		y = y + ysize;
	}
	if( y >= ysize )
	{
		y = y - ysize;
	}
	
	
	
	if(tx==1)
	{
		if(texture1[(y*xsize +x)*4 + 0] == 0)state=1
	}
	else
	{
		if(texture2[(y*xsize +x)*4 + 0] == 0)state=1
	}
	return state;
}

function set_cell(tx,x,y,set)
{
  	var numssegs = parseFloat(document.getElementById('numssegs').value);

	if(x < 0)
	{
		x = x+xsize;
		y = y-ysize/numssegs;
		if(y<0)
		{
			y = y + ysize;
		}
	}
	if(x >= xsize)
	{
		x = x -xsize;
		y = y + ysize/numssegs;
		if( y > ysize)
		{
			y = y - ysize;
		}
	}
	if( y < 0 )
	{
		y = y + ysize;
	}
	if( y >= ysize )
	{
		y = y - ysize;
	}


	if(tx==1)
	{
		texture1[(y*xsize +x)*4 + 0] = set?0:128;
		texture1[(y*xsize +x)*4 + 1] = set?0:128;
		texture1[(y*xsize +x)*4 + 2] = set?0:128;
		texture1[(y*xsize +x)*4 + 3] = 255;
	}
	else
	{
		texture2[(y*xsize +x)*4 + 0] = set?0:128;
		texture2[(y*xsize +x)*4 + 1] = set?0:128;
		texture2[(y*xsize +x)*4 + 2] = set?0:128;
		texture2[(y*xsize +x)*4 + 3] = 255;
	}
}

function next_gen(old_tx, new_tx)
{
	var x;
	var y;
	
	fill_texture(new_tx);

	for(y=0;y<ysize;y++)
	{
		for(x=0;x<xsize;x++)
		{
			var neighbours;
			
			neighbours = 
			get_cell(old_tx,x-1,y+1) +		
			get_cell(old_tx,x,y+1) +		
			get_cell(old_tx,x+1,y+1) +		
			get_cell(old_tx,x-1,y) +		
			get_cell(old_tx,x+1,y) +		
			get_cell(old_tx,x-1,y-1) +		
			get_cell(old_tx,x,y-1) +		
			get_cell(old_tx,x+1,y-1);		
			
//			if(neighbours != 0)
//			{
//				alert(old_tx.toString()+' '+x.toString()+' '+y.toString()+' '+neighbours.toString());
//			}
			
			
			if(neighbours == 2)
			{
				set_cell(new_tx, x, y, get_cell(old_tx, x, y));
			}
			else if(neighbours == 3)
			{
				set_cell(new_tx, x, y, 1);
			}
		}
	}

}


function init_texture(tx)
{
	var x=5;
	var y=150;
	
//	/* r-pentomino */
	if(0)
	{	
		set_cell(1, x, y, 1)
		set_cell(1, x, y+1, 1)
		set_cell(1, x+1, y, 1)
		set_cell(1, x+1, y+2, 1)
		set_cell(1, x+2, y, 1)
	}
	
	
	if(0)
	{	
		set_cell(1, x, y, 1)
		set_cell(1, x, y+1, 1)
		set_cell(1, x, y+2, 1)
		set_cell(1, x+1, y+2, 1)
		set_cell(1, x+2, y+1, 1)
	}
	
	if(0)
	{

// oscillator
	set_cell(1, x, y, 1)
	set_cell(1, x-1, y, 1)
	set_cell(1, x+1, y, 1)
	set_cell(1, x+2, y, 1)
	set_cell(1, x+3, y, 1)
	}
	
	if(1) //acorn
	{
		set_cell(1, x, y, 1)
		set_cell(1, x+1, y, 1)
		set_cell(1, x+4, y, 1)
		set_cell(1, x+5, y, 1)
		set_cell(1, x+6, y, 1)
		set_cell(1, x+3, y+1, 1)
		set_cell(1, x+1, y+2, 1)
//		.O.....
//		...O...
//		OO..OOO
	}
}

function create_texture()
{
	fill_texture(1);
	init_texture(1);
	fill_texture(2);
	textureId = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, textureId);
	
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST /* or LINEAR */);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST /* or LINEAR */);
	
}
