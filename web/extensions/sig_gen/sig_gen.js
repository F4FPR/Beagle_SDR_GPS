// Copyright (c) 2016 John Seamons, ZL/KF6VO

var gen = {
   ext_name: 'sig_gen',    // NB: must match sig_gen.c:sig_gen.name
   first_time: true,

	freq: 10000,
	freq_stop: 10006,
	step: 0.1,
	dwell: 300,
	attn_dB: 80,
	attn_ampl: 0,
	filter: 0,

   func: 1,
   OFF: 0,
   RF: 1,
   AF: 2,
   func_s: ['off', 'RF tone', 'AF noise'],
	rf_enable: true,
	sweeping: 0,
	cicf: 0,
	cich: 0,
	cicw: 0,

	attn_offset_val: 0,
	attn_offset: 1,
	attn_offset_s: [ 'no offset', 'waterfall' ]
};

function sig_gen_main()
{
	ext_switch_to_client(gen.ext_name, gen.first_time, gen_recv);		// tell server to use us (again)
	if (!gen.first_time)
		gen_auth();
	gen.first_time = false;
}

function gen_recv(data)
{
	var firstChars = arrayBufferToStringLen(data, 3);
	
	// process data sent from server/C by ext_send_msg_data()
	if (firstChars == "DAT") {
		var ba = new Uint8Array(data, 4);
		var cmd = ba[0];
		var o = 1;
		var len = ba.length-1;

		console.log('gen_recv: DATA UNKNOWN cmd='+ cmd +' len='+ len);
		return;
	}
	
	// process command sent from server/C by ext_send_msg() or ext_send_msg_encoded()
	var stringData = arrayBufferToString(data);
	var params = stringData.substring(4).split(" ");

	for (var i=0; i < params.length; i++) {
		var param = params[i].split("=");

		if (0 && param[0] != "keepalive") {
			if (isDefined(param[1]))
				console.log('gen_recv: '+ param[0] +'='+ param[1]);
			else
				console.log('gen_recv: '+ param[0]);
		}

		switch (param[0]) {

			case "ready":
				gen_auth();
				break;

			default:
				console.log('gen_recv: UNKNOWN CMD '+ param[0]);
				break;
		}
	}
}

function gen_auth()
{
	admin_pwd_query(function() { gen_controls_setup(); });
}

function gen_controls_setup()
{
	gen.attn_offset_s[1] = 'waterfall cal '+ cfg.waterfall_cal +'dB';
   gen.save_freq = gen.freq;
   var do_sweep = 0;
	
	gen.url_params = ext_param();
	var p = gen.url_params;
   if (p) {
      p = p.split(',');
      if (isDefined(p[0])) gen.freq = +p[0];
      if (isDefined(p[1])) gen.freq_stop = +p[1];
      if (isDefined(p[2])) gen.step = +p[2];
      if (isDefined(p[3])) gen.dwell = +p[3];
      if (isDefined(p[4])) gen.attn_dB = +p[4];
      if (isDefined(p[5])) do_sweep = +p[5];
      if (gen.attn_dB < 0) gen.attn_dB = -gen.attn_dB;
   }
   
	var controls_html =
		w3_div('id-test-controls w3-text-white',
			w3_divs('/w3-tspace-8',
				w3_div('w3-medium w3-text-aqua', '<b>Signal generator</b>'),
				w3_div('', 'All frequencies in kHz'),
            w3_inline('',
               w3_input('w3-padding-small w3-width-90 w3-margin-right', 'Start', 'gen.freq', gen.freq, 'gen_freq_cb'),
               w3_input('w3-padding-small w3-width-90 w3-margin-right', 'Stop', 'gen.freq_stop', gen.freq_stop, 'gen_stop_cb'),
               w3_input('w3-padding-small w3-width-90 w3-margin-right', 'Step', 'gen.step', gen.step, 'gen_step_cb'),
               w3_input('w3-padding-small w3-width-90', 'Dwell (ms)', 'gen.dwell', gen.dwell, 'w3_num_cb')
            ),
				w3_inline('w3-margin-top/w3-margin-between-16 w3-valign',
				   //w3_switch('', 'On', 'Off', 'gen.rf_enable', gen.rf_enable, 'gen_enable_cb'),
               w3_select('w3-text-red', 'Function', '', 'gen.func', gen.func, gen.func_s, 'gen_func_cb'),
				   w3_button('w3-red', '-Step', 'gen_step_up_down_cb', -1),
				   w3_button('w3-green', '+Step', 'gen_step_up_down_cb', +1),
				   w3_button('id-gen-sweep w3-css-yellow', 'Sweep', 'gen_sweep_cb'),
               dbgUs? w3_checkbox('w3-label-inline w3-label-not-bold', 'CICF<br>filter', 'gen.cicf', gen.cicf, 'gen_cicf_cb'):'',
               dbgUs? w3_checkbox('w3-label-inline w3-label-not-bold', 'HW<br>filter', 'gen.cich', gen.cich, 'gen_cich_cb'):'',
               dbgUs? w3_checkbox('w3-label-inline w3-label-not-bold', 'FW<br>filter', 'gen.cicw', gen.cicw, 'gen_cicw_cb'):''
				),
				w3_col_percent('w3-margin-top',
               w3_slider('', 'Attenuation', 'gen.attn_dB', gen.attn_dB, 0, 100, 5, 'gen_attn_cb'), 35,
               w3_div(''), 10,
               w3_div('',
				      w3_div('', 'Offset attenuation by:'),
                  w3_select('w3-text-red w3-width-auto', '', '', 'gen.attn_offset', gen.attn_offset, gen.attn_offset_s, 'gen_attn_offset_cb')
               ), 55
            )
			)
		);

	ext_panel_show(controls_html, null, null);
	ext_set_controls_width_height(dbgUs? 575 : 450, 250);
	gen_freq_cb('gen.freq', gen.freq);

	// if no URL "f=" param set freq so signal appears on screen
	// (in case off screen at current zoom level)
	if (kiwi_url_param('f', null, null) == null)
      ext_tune(gen.freq, null, ext_zoom.CUR);

	toggle_or_set_spec(toggle_e.SET, spec.RF);
	spec.saved_audio_comp = ext_get_audio_comp();
	if (spec.saved_audio_comp) ext_set_audio_comp(false);
	ext_send('SET wf_comp=0');
	if (do_sweep) gen_sweep_cb();
}

function gen_set(freq, attn, always)
{
   //console.log('gen_set f='+ freq +' a='+ attn);
   //kiwi_trace();
   if (always == true || gen.rf_enable) set_gen(freq, attn);
}

/*
function gen_enable_cb(path, idx, first)
{
	idx = +idx;
	gen.rf_enable = (idx == 0);
	//console.log('gen_enable_cb rf_enable='+ gen.rf_enable +' f='+ (gen.rf_enable? gen.freq : 0));
	if (!gen.rf_enable && gen.sweeping) gen_sweep_cancel();
	gen_set(gen.rf_enable? gen.freq : 0, gen.attn_ampl, true);
   colormap_update();
   ext_send('SET run='+ (gen.rf_enable? '1':'0'));
}
*/

function gen_run()
{
   var run = ((gen.func == gen.RF)? 1 : ((gen.func == gen.AF)? 2:0)) | (gen.cicf? 4:0) | (gen.cich? 8:0) | (gen.cicw? 16:0);
   ext_send('SET run='+ run);
}

function gen_func_cb(path, idx, first)
{
	gen.func = +idx;
	gen.rf_enable = (gen.func == gen.RF);
	//console.log('gen_func_cb func='+ gen.func +' f='+ (gen.rf_enable? gen.freq : 0));
	if (!gen.rf_enable && gen.sweeping) gen_sweep_cancel();
	gen_attn_cb('gen.attn_dB', gen.attn_dB, true);     // add/remove gen.attn_offset_val for RF/AF mode
	gen_set(gen.rf_enable? gen.freq : 0, gen.attn_ampl, true);
   colormap_update();
   gen_run();
}

function gen_cicf_cb(path, checked, first)
{
   if (first) return;
   w3_bool_cb(path, checked, first);
   gen_run();
}

function gen_cich_cb(path, checked, first)
{
   if (first) return;
   w3_bool_cb(path, checked, first);
   gen_run();
}

function gen_cicw_cb(path, checked, first)
{
   if (first) return;
   w3_bool_cb(path, checked, first);
   gen_run();
}

function gen_freq_cb(path, val)
{
   // might not be a string if not called from w3_input()
   //console.log('gen_freq_cb: val='+ val +' '+ typeof(val));
	gen.freq = val.toString().parseFloatWithUnits('kM', 1e-3, 3);
	w3_num_cb(path, gen.freq);
	w3_set_value(path, gen.freq);
	
	// to minimize glitch in waterfall peak mode
	// don't switch NCO frequency unless fully attenuated
	if (gen.old_freq) gen_set(gen.old_freq, 0);
	gen_set(gen.freq, 0);
	gen_set(gen.freq, gen.attn_ampl);
	gen.old_freq = gen.freq;
}

function gen_stop_cb(path, val, first)
{
   gen.freq_stop = val.parseFloatWithUnits('kM', 1e-3, 3);
	w3_num_cb(path, gen.freq_stop);
	w3_set_value(path, gen.freq_stop);
}

function gen_step_cb(path, val, first)
{
   console.log('gen_step_cb: val='+ val +' '+ typeof(val));
   gen.step = val.parseFloatWithUnits('kM', 1e-3, 3);
	w3_num_cb(path, gen.step);
	w3_set_value(path, gen.step);
}

function gen_step_up_down_cb(path, sign, first)
{
   var step = parseInt(sign) * gen.step;
   console.log('gen_step_up_down_cb: step='+ step +' '+ typeof(step));
   gen.freq += step;
   gen.freq = w3_clamp(gen.freq, 0, cfg.max_freq? 32e3 : 30e3);
	gen_freq_cb('gen.freq', gen.freq);
}

function gen_sweep_cancel()
{
   kiwi_clearInterval(gen.sweep_interval);
   gen_freq_cb('gen.freq', gen.save_freq);
   w3_button_text('id-gen-sweep', 'Sweep', 'w3-css-yellow', 'w3-red');
   gen.sweeping = 0;
}

function gen_sweep_cb(path, val, first)
{
   if (first) return;
   
   if (!gen.sweeping && gen.rf_enable) {
      gen.save_freq = gen.freq;
      w3_button_text('id-gen-sweep', 'Stop', 'w3-red', 'w3-css-yellow');
      console.log('$ gen_sweep_cb');
      gen.sweep_interval = setInterval(function() {
         var prev = gen.freq;
         gen.freq += gen.step;
	      console.log('gen_sweep_cb '+ prev.toFixed(3) +'|'+ gen.step.toFixed(3) +'|'+ gen.freq.toFixed(3));
	      var stop = ((gen.step > 0 && gen.freq > gen.freq_stop) || (gen.step < 0 && gen.freq < gen.freq_stop));
         if (stop || gen.freq < 0.01 || gen.freq > (cfg.max_freq? 32e3 : 30e3))
            gen_sweep_cancel();
         gen_freq_cb('gen.freq', gen.freq);
      }, gen.dwell);
      gen.sweeping = 1;
   } else {
      gen_sweep_cancel();
   }
}

function gen_attn_cb(path, val, complete)
{
   gen.attn_dB = +val;
	var dB = gen.attn_dB + ((gen.func == gen.RF)? gen.attn_offset_val : 0);
	if (dB < 0) dB = 0;
	var attn_ampl = Math.pow(10, -dB/20);		// use the amplitude form since we are multipling a signal
	gen.attn_ampl = 0x1ffff * attn_ampl;      // hardware gen_attn is 18-bit signed so max pos is 0x1ffff
	//console.log('gen_attn gen.attn_dB='+ gen.attn_dB +' attn_offset_val='+ gen.attn_offset_val +' dB='+ dB +' attn_ampl='+ gen.attn_ampl.toFixed(1) +' / '+ gen.attn_ampl.toHex());
	w3_num_cb(path, gen.attn_dB);
	w3_set_label('Attenuation '+ (-gen.attn_dB).toString() +' dB', path);
	
	if (complete) {
		gen_set(gen.freq, gen.attn_ampl);
      ext_send('SET attn='+ gen.attn_ampl.toFixed(0));
		colormap_update();
	}
}

function gen_attn_offset_cb(path, idx, first)
{
   idx = +idx;
   gen.attn_offset_val = (idx == 0)? 0 : cfg.waterfall_cal;
   gen_attn_cb('gen.attn_dB', gen.attn_dB, true);
}

// hook that is called when controls panel is closed
function sig_gen_blur()
{
	//console.log('### sig_gen_blur');
	gen_set(0, 0, true);
	ext_send('SET run=0');
	if (spec.saved_audio_comp) ext_set_audio_comp(true);
	ext_send('SET wf_comp=1');
   toggle_or_set_spec(toggle_e.SET, spec.NONE);
}

// called to display HTML for configuration parameters in admin interface
function sig_gen_config_html()
{
   ext_config_html(gen, 'sig_gen', 'Sig Gen', 'Signal Generator configuration');
}
