#ifdef GL_ES
precision mediump float;
#endif


// Shader Inputs
// uniform vec3      iResolution;           // viewport resolution (in pixels)
// uniform float     iGlobalTime;           // shader playback time (in seconds)
// uniform float     iTimeDelta;            // render time (in seconds)
// uniform int       iFrame;                // shader playback frame
// uniform float     iChannelTime[4];       // channel playback time (in seconds)
// uniform vec3      iChannelResolution[4]; // channel resolution (in pixels)
// uniform vec4      iMouse;                // mouse pixel coords. xy: current (if MLB down), zw: click
// uniform samplerXX iChannel0..3;          // input channel. XX = 2D/Cube
// uniform vec4      iDate;                 // (year, month, day, time in seconds)
// uniform float     iSampleRate;           // sound sample rate (i.e., 44100)


uniform vec3      iResolution;           // viewport resolution (in pixels)
uniform float     iGlobalTime;           // shader playback time (in seconds)
//uniform float     iTimeDelta;            // render time (in seconds)
//uniform int       iFrame;                // shader playback frame
//uniform float     iChannelTime[4];       // channel playback time (in seconds)
//uniform vec3      iChannelResolution[4]; // channel resolution (in pixels)
uniform vec4      iMouse;                // mouse pixel coords. xy: current (if MLB down), zw: click
//uniform samplerXX iChannel0..3;          // input channel. XX = 2D/Cube
uniform vec4      iDate;                 // (year, month, day, time in seconds)
//uniform float     iSampleRate;           // sound sample rate (i.e., 44100)

#define iChannel0 CC_Texture0
#define iChannel1 CC_Texture0
#define iChannel2 CC_Texture0
#define iChannel3 CC_Texture0
#define iChannel4 CC_Texture0




//_______________________________________________________________________________________________________

#define PI 3.14159265359

vec3 col1 = vec3(0.216, 0.471, 0.698); // blue
vec3 col2 = vec3(1.00, 0.329, 0.298); // yellow
vec3 col3 = vec3(0.867, 0.910, 0.247); // red

float disk(vec2 r, vec2 center, float radius) {
	return 1.0 - smoothstep( radius-0.008, radius+0.008, length(r-center));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	float t = iGlobalTime*2.;
	vec2 r = (2.0*fragCoord.xy - iResolution.xy) / iResolution.y;
	r *= 1.0 + 0.05*sin(r.x*5.+iGlobalTime) + 0.05*sin(r.y*3.+iGlobalTime);
	r *= 1.0 + 0.2*length(r);
	float side = 0.5;
	vec2 r2 = mod(r, side);
	vec2 r3 = r2-side/2.;
	float i = floor(r.x/side)+2.;
	float j = floor(r.y/side)+4.;
	float ii = r.x/side+2.;
	float jj = r.y/side+4.;	
	
	vec3 pix = vec3(1.0);
	
	float rad, disks;
		
	rad = 0.15 + 0.05*sin(t+ii*jj);
	disks = disk(r3, vec2(0.,0.), rad);
	pix = mix(pix, col2, disks);

	float speed = 2.0;
	float tt = iGlobalTime*speed+0.1*i+0.08*j;
	float stopEveryAngle = PI/2.0;
	float stopRatio = 0.7;
	float t1 = (floor(tt) + smoothstep(0.0, 1.0-stopRatio, fract(tt)) )*stopEveryAngle;
		
	float x = -0.07*cos(t1+i);
	float y = 0.055*(sin(t1+j)+cos(t1+i));
	rad = 0.1 + 0.05*sin(t+i+j);
	disks = disk(r3, vec2(x,y), rad);
	pix = mix(pix, col1, disks);
	
	rad = 0.2 + 0.05*sin(t*(1.0+0.01*i));
	disks = disk(r3, vec2(0.,0.), rad);
	pix += 0.2*col3*disks * sin(t+i*j+i);

	pix -= smoothstep(0.3, 5.5, length(r));	
	fragColor = vec4(pix,1.0);
}
//_______________________________________________________________________________________________________





void main( void)
{
	mainImage(gl_FragColor, gl_FragCoord.xy);
}