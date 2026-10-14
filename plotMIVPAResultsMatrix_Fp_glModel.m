function [] = plotMIVPAResultsMatrix_Fp_glModel(resultsMatrix, globalModel)
% globalModel=loadRAMIStruct( '.\globalModel_TX\globalModel_FpFg_4DOF_00p25.mat');
% globalModel=loadRAMIStruct( '.\globalModel_TX\globalModel_00p50_01p50.mat');
% globalModel=loadRAMIStruct('.\globalModel_TZ\globalModel_01p50_01p50.mat');
idx=1:numel(resultsMatrix);
%% MI
% Flag Declarations
flag.save = 0; %Flag for saving the results
flag.filterVPA = 0;
directionLabel = 'Transl'; % 'Rotat' oder % 'Transl'
directionExcitation ='Z'; % 'Xim', 'Y' oder 'Z'
directionExcitationLower = lower(directionExcitation); % 'x', 'y' oder 'z'
% Percentile band limits applied per frequency across all pooled curves
prc = [5 95];
if directionLabel(1) == 'T' & directionExcitation == 'Y' | directionLabel(1) == 'R'
    OptimRange = 100; % Frequency range till which the optimization will be accomplished
else
    OptimRange = 500;
end
if directionLabel(1) == 'T' & any (directionExcitation == 'X' | directionExcitation == 'Z')
    flag.filterData = 1;
    filterIdx = 19:20:79; % Frequencies where the mean of the neighboring values is used, e.g. TX at 100, 200, 300, 400Hz - 19=100Hz +20=+100Hz
elseif directionLabel(1) == 'T' & directionExcitation == 'Y'
    flag.filterData = 1;
    filterIdx = 9;
else
    flag.filterData = 0;
end
if directionExcitation == 'X' | directionExcitation == 'Z'
FgSteps = [25 65 95 135];
FpSteps = [30 55 75 100];
elseif directionExcitation == 'Y'
FgSteps = [70 95 110 135];
FpSteps = [25 40 50 65];
end
dirISO = [directionExcitationLower 'direction'];
ISO10068_MeanImpedance.signals.xdirection.mi.data = [38,49,54,64,72,80,95,112,140,172,199,211,210,208,189,207,224,292]; %wie DIN45677
ISO10068_MeanImpedance.signals.xdirection.milower.data = [24,30,33,36,43,51,62,74,90,109,120,124,123,120,119,120,134,168];
ISO10068_MeanImpedance.signals.xdirection.miupper.data = [59,71,80,84,104,125,154,189,233,280,300,302,294,287,287,302,260,442];
ISO10068_MeanImpedance.signals.xdirection.phase.data = [53,53,53,54,57,53,53,51,47,43,37,31,29,23,24,25,26,29]; %wie DIN45677
ISO10068_MeanImpedance.signals.xdirection.phaselower.data = [36;38;38;38;38;38;37;36;33;29;23;18;11;7;6;6;8;10]';
ISO10068_MeanImpedance.signals.xdirection.phaseupper.data = [68;69;70;71;72;73;73;70;66;63;60;57;52;48;45;44;45;47]';
ISO10068_MeanImpedance.signals.ydirection.mi.data = [55,62,70,86,96,88,102,101,93,86,86,80,77,71,67,69,71,79]; %wie DIN45677
ISO10068_MeanImpedance.signals.ydirection.milower.data = [21,23,26,30,35,40,48,55,61,64,63,60,54,49,45,45,51,66];
ISO10068_MeanImpedance.signals.ydirection.miupper.data = [80,90,106,119,128,132,135,130,117,106,106,106,107,108,110,113,118,134];
ISO10068_MeanImpedance.signals.ydirection.phase.data = [39,35,32,31,23,18,7,-1,-2,-5,-9,-11,-7,-6,0,8,16,22]; %wie DIN45677
ISO10068_MeanImpedance.signals.ydirection.phaselower.data = [20,15,11,6,1,-6,-12,-18,-22,-23,-23,-22,-19,-16,-11,-7,-4,1];
ISO10068_MeanImpedance.signals.ydirection.phaseupper.data = [55,54,52,49,44,39,30,22,16,10,7,6,7,9,17,30,45,56];
ISO10068_MeanImpedance.signals.zdirection.mi.data = [145,149,181,217,266,311,315,263,216,170,158,156,163,184,212,235,243,254];
ISO10068_MeanImpedance.signals.zdirection.milower.data = [120,80,133,141,200,275,240,220,140,95,85,100,108,113,150,150,190,185];
ISO10068_MeanImpedance.signals.zdirection.miupper.data = [200,225,250,325,361,365,358,321,285,240,239,240,247,271,320,363,365,362];
ISO10068_MeanImpedance.signals.zdirection.phase.data = [29,29,31,31,26,16,-1,-13,-15,-11,-1,6,16,21,21,20,21,21];
ISO10068_MeanImpedance.signals.zdirection.phaselower.data = [15,10,5,0,0,-2,-13,-33,-47,-37,-12,-5,5,10,13,5,2,7];
ISO10068_MeanImpedance.signals.zdirection.phaseupper.data = [45,46,48,49,44,27,6,3,1,-2,6,20,30,34,29,30,32,30];
ISO10068_MeanImpedance.frequencies.data = [10,12.5,16,20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500];
ISO10068_MeanImpedance.signals.xdirection.mi.unit='Ns/m';
ISO10068_MeanImpedance.signals.xdirection.milower.unit='Ns/m';
ISO10068_MeanImpedance.signals.xdirection.miupper.unit='Ns/m';
ISO10068_MeanImpedance.signals.ydirection.mi.unit='Ns/m';
ISO10068_MeanImpedance.signals.ydirection.milower.unit='Ns/m';
ISO10068_MeanImpedance.signals.ydirection.miupper.unit='Ns/m';
ISO10068_MeanImpedance.signals.zdirection.mi.unit='Ns/m';
ISO10068_MeanImpedance.signals.zdirection.milower.unit='Ns/m';
ISO10068_MeanImpedance.signals.zdirection.miupper.unit='Ns/m';
ISO10068_MeanImpedance.signals.xdirection.mi.name='Mean Mechanical Impedance x-direction';
ISO10068_MeanImpedance.signals.xdirection.milower.name='Lower Limit of Mean Mechanical Impedance x-direction';
ISO10068_MeanImpedance.signals.xdirection.miupper.name='Lower Limit of Mean Mechanical Impedance x-direction';
ISO10068_MeanImpedance.signals.ydirection.mi.name='Mean Mechanical Impedance y-direction';
ISO10068_MeanImpedance.signals.ydirection.milower.name='Lower Limit of Mean Mechanical Impedance y-direction';
ISO10068_MeanImpedance.signals.ydirection.miupper.name='Upper Limit of Mean Mechanical Impedance y-direction';
ISO10068_MeanImpedance.signals.zdirection.milower.name='Lower Limit of Mean Mechanical Impedance z-direction';
ISO10068_MeanImpedance.signals.zdirection.miupper.name='Upper Limit of Mean Mechanical Impedance z-direction';
ISO10068_MeanImpedance.signals.zdirection.mi.name='Mean Mechanical Impedance z-direction';
ISO10068_MeanImpedance.signals.xdirection.phase.unit='Degrees';
ISO10068_MeanImpedance.signals.xdirection.phaselower.unit='Degrees';
ISO10068_MeanImpedance.signals.xdirection.phaseupper.unit='Degrees';
ISO10068_MeanImpedance.signals.ydirection.phase.unit='Degrees';
ISO10068_MeanImpedance.signals.ydirection.phaselower.unit='Degrees';
ISO10068_MeanImpedance.signals.ydirection.phaseupper.unit='Degrees';
ISO10068_MeanImpedance.signals.zdirection.phase.unit='Degrees';
ISO10068_MeanImpedance.signals.zdirection.phaselower.unit='Degrees';
ISO10068_MeanImpedance.signals.zdirection.phaseupper.unit='Degrees';
ISO10068_MeanImpedance.signals.xdirection.phase.name='Mean Phase Angle x-direction';
ISO10068_MeanImpedance.signals.xdirection.phaselower.name='Lower Limit of Mean Phase Angle x-direction';
ISO10068_MeanImpedance.signals.xdirection.phaseupper.name='Upper Limit of Mean Phase Angle x-direction';
ISO10068_MeanImpedance.signals.ydirection.phase.name='Mean Phase Angle y-direction';
ISO10068_MeanImpedance.signals.ydirection.phaselower.name='Lower Limit of Mean Phase Angle y-direction';
ISO10068_MeanImpedance.signals.ydirection.phaseupper.name='Upper Limit of Mean Phase Angle y-direction';
ISO10068_MeanImpedance.signals.zdirection.phase.name='Mean Phase Angle z-direction';
ISO10068_MeanImpedance.signals.zdirection.phaselower.name='Lower Limit of Mean Phase Angle z-direction';
ISO10068_MeanImpedance.signals.zdirection.phaseupper.name='Upper Limit of Mean Phase Angle z-direction';
ISO10068_MeanImpedance.frequencies.unit = 'Hz';
ISO10068_MeanImpedance.frequencies.name = 'One-Third-Octave Band Centre Frequencies';
ISO10068_MeanImpedance.metadata.name = 'ISO10068 - Driving Point Mechanical Impedance as Mean with Lower and Upper Limits';
freq = resultsMatrix(1).freq_vec;
freq = freq(:);          % ensure column vector for fill/patch
w = 2*pi*freq; % Transform to rad/s from Hz
Fg = [resultsMatrix(:).MeanGripForce];
Fp = [resultsMatrix(:).MeanPushForce];
Fg = Fg(:);
Fp = Fp(:);
% Get all measured MI / VPA
count    = size(idx,2);
MI_meas  = zeros(numel(resultsMatrix(1).MI(:,1,1)),count);
VPA_meas = zeros(numel(resultsMatrix(1).MI(:,1,1)),count);
MI_model = zeros(numel(resultsMatrix(1).MI(:,1,1)), count);   % complex
VPA_model = zeros(numel(resultsMatrix(1).MI(:,1,1)), count);   % complex
idxDirAcc = [resultsMatrix(:).accDir];
idxDirF   = [resultsMatrix(:).forceDir];
idxDirAcc = idxDirAcc(:);
idxDirF   = idxDirF(:);
% Modell-Funktionen / Parameter
M = globalModel.M;
m_beta_Matrix = globalModel.m_beta_Matrix;
d_beta_Matrix = globalModel.d_beta_Matrix;
k_beta_Matrix = globalModel.k_beta_Matrix;
for i = 1:1:count
    n = idx(i);
    MI_meas(:,i)  = resultsMatrix(n).MI(:, idxDirF(n), idxDirAcc(n));
    VPA_meas(:,i) = resultsMatrix(n).VPA(:,idxDirF(n),idxDirAcc(n));
      % Modell für diese Messung
    m_row = M(Fg(n), Fp(n), m_beta_Matrix);
    d_row = M(Fg(n), Fp(n), d_beta_Matrix);
    k_row = M(Fg(n), Fp(n), k_beta_Matrix);
    m_row = max(m_row, 1e-9);
    d_row = max(d_row, 1e-9);
    k_row = max(k_row, 1e-9);
    [MI_tmp, ~] = impedance_mkd(m_row, d_row, k_row, w);
    MI_model(:,i) = MI_tmp(:);
    VPA_model(:,i)= real(MI_model(:,i)).*(abs(resultsMatrix(n).ajw./(1i*2*pi*freq))).^2;
end
%% Group assignment by push-force level (pool all grip-force levels)
% Each measurement is assigned to the nearest push-force step in FpSteps.
[~,FpTap] = min(abs(Fp(:)-FpSteps),[],2);
FpTap = FpTap(:);
FpGroups = unique(FpTap)';        % present push-force levels (subset of 1..4)
nG       = numel(FpGroups);
cmap     = parula(nG);            % one colour per push-force level
cbarLabels = strings(1,nG);
for gi = 1:1:nG
    cbarLabels(gi) = sprintf('F_{P} ~%3.0f N', FpSteps(FpGroups(gi)));
end
%% MI Plot - push-force mean curves with 5th-95th percentile band
f2 = customFigure('Impedance', 13, 8.5);
ax(1) = subplot(2,1,1);
ax(2) = subplot(2,1,2);
for i = 1:1:numel(ax)
    hold(ax(i),"on");
    grid(ax(i),"on");
    box(ax(i),"on");
end
magMeanPlot = zeros(numel(resultsMatrix(1).freq_vec),nG);
magMeanModelPlot = zeros(numel(resultsMatrix(1).freq_vec),nG);
phiMeanPlot = zeros(numel(resultsMatrix(1).freq_vec),nG);
phiMeanModelPlot = zeros(numel(resultsMatrix(1).freq_vec),nG);
for gi = 1:1:nG
    cols = (FpTap == FpGroups(gi));   % all grip forces for this push-force level
    col  = cmap(gi,:);
    % Magnitude: arithmetic mean + percentile band on |Z_h|
    [magMean, magLo, magHi] = bandStatsReal(abs(MI_meas(:,cols)), prc);
    [magMeanModel, magLoModel, magHiModel] = bandStatsReal(abs(MI_model(:,cols)), prc);
    magMeanPlot(:,gi) = magMean;
    magMeanModelPlot(:,gi) = magMeanModel;
    % fill(ax(1), [freq; flipud(freq)], [magLo; flipud(magHi)], col, ...
    %     'FaceAlpha',0.15, 'EdgeColor','none', 'HandleVisibility','off');
    % Phase: circular mean + percentile band on wrapped deviations (unwrapped for plot)
    [phiMean, phiLo, phiHi] = bandStatsPhase(MI_meas(:,cols), prc);
    [phiMeanModel, phiLoModel, phiHiModel] = bandStatsPhase(MI_model(:,cols), prc);
    phiMeanPlot(:,gi) = phiMean;
    phiMeanModelPlot(:,gi) = phiMeanModel;
    % fill(ax(2), [freq; flipud(freq)], [phiLo; flipud(phiHi)], col, ...
    %     'FaceAlpha',0.15, 'EdgeColor','none', 'HandleVisibility','off');
end
for gi = 1:1:nG
    cols = (FpTap == FpGroups(gi));   % all grip forces for this push-force level
    col  = cmap(gi,:);
    % Mean lines on top
    plot(ax(1), freq, magMeanPlot(:,gi), 'LineWidth',1.0, 'Color',col, 'HandleVisibility','off');
    plot(ax(2), freq, phiMeanPlot(:,gi), 'LineWidth',1.0, 'Color',col, 'HandleVisibility','off');
    plot(ax(1), freq, magMeanModelPlot(:,gi), 'LineWidth',1.0, 'Color',col, 'HandleVisibility','off','LineStyle','-.');
    plot(ax(2), freq, phiMeanModelPlot(:,gi), 'LineWidth',1.0, 'Color',col, 'HandleVisibility','off','LineStyle','-.');
end
% Dummy handle for the band legend entry
hBand = patch(ax(1), NaN, NaN, [0.6 0.6 0.6], 'FaceAlpha',0.15, 'EdgeColor','none');
% if directionLabel(1) == 'T'
%     p1=plot(ax(1), ISO10068_MeanImpedance.frequencies.data,...
%         ISO10068_MeanImpedance.signals.(dirISO).mi.data(:), 'k', 'LineWidth',0.8);
%     p2=plot(ax(1), ISO10068_MeanImpedance.frequencies.data,...
%         ISO10068_MeanImpedance.signals.(dirISO).milower.data(:), 'k--','LineWidth',0.8);
%     p3=plot(ax(1), ISO10068_MeanImpedance.frequencies.data,...
%         ISO10068_MeanImpedance.signals.(dirISO).miupper.data(:), 'k--','LineWidth',0.8);
%     p4=plot(ax(2), ISO10068_MeanImpedance.frequencies.data,...
%         deg2rad(ISO10068_MeanImpedance.signals.(dirISO).phase.data(:)), 'k','LineWidth',0.8);
%     p5=plot(ax(2), ISO10068_MeanImpedance.frequencies.data,...
%         deg2rad(ISO10068_MeanImpedance.signals.(dirISO).phaseupper.data(:)), 'k--','LineWidth',0.8);
%     p6=plot(ax(2), ISO10068_MeanImpedance.frequencies.data,...
%         deg2rad(ISO10068_MeanImpedance.signals.(dirISO).phaselower.data(:)), 'k--','LineWidth',0.8);
% end
for i = 1:1:numel(ax)
    set(ax(i), 'XScale','log');
end
xlabel(ax(2),'Frequency in Hz');
ylabel(ax(1), '|Z_h| in Ns/m');
ylabel(ax(2),'\angleZ_h in rad');
% if directionLabel(1) == 'T' & (directionExcitation == 'Y' | directionExcitation == 'Z')
%     ylim(ax(1), [0 800]);
%     set(ax(2), 'YLim', [-pi pi], ...
%     'YTick', [-pi -pi/2 0 pi/2 pi])
% yticklabels(ax(2),{'-\pi','-\pi/2','0','\pi/2','\pi'})
% elseif directionLabel(1) == 'T' & directionExcitation == 'X'
%     ylim(ax(1), [0 600]);
%     set(ax(2), 'YLim', [-pi/4 pi/2], ...
%     'YTick', [-pi/4 0 pi/4 pi/2])
% yticklabels(ax(2),{'-\pi/4','0','\pi/4','\pi/2'})
% elseif directionLabel(1) == 'R'
%     ylim(ax(1), [0 1.5]);
%     set(ax(2), 'YLim', [-pi pi], ...
%     'YTick', [-pi -pi/2 0 pi/2 pi])
% yticklabels(ax(2),{'-\pi','-\pi/2','0','\pi/2','\pi'})
% end
xticklabels(ax(1),[])
for i = 1:1:numel(ax)
    if directionLabel(1) == 'T' & directionExcitation == 'X' | directionLabel(1) == 'T' & directionExcitation == 'Z'
        xlim(ax(i), [10 500])
    elseif directionLabel(1) == 'T' & directionExcitation == 'Y' | directionLabel(1) == 'R'
        xlim(ax(i), [10 100])
    end
end
ax(1).Position = [0.10 0.58 0.67 0.37];
ax(2).Position = [0.10 0.16 0.67 0.37];
modifyFigure('fig', f2, ...
    'FontName', 'Arial', ...
    'FontSize', 8);
% Discrete colorbar for the push-force levels (replaces Fp legend)
colormap(ax(1), cmap);
clim(ax(1), [0.5 nG+0.5]);                 % nG clearly separated colour blocks
c = colorbar(ax(1));
c.Ticks      = 1:nG;
c.TickLabels = cellstr(cbarLabels);
c.Position   = [0.80 0.16 0.02 0.79];
c.FontSize   = 6;
c.FontName   = 'Arial';
ax(1).Position = [0.10 0.58 0.67 0.37];    % reassert (colorbar resizes parent)
ax(2).Position = [0.10 0.16 0.67 0.37];
% Small legend for band + ISO only (line styles cannot be shown in colorbar)
% if directionLabel(1) == 'T'
%     legend(ax(1), [hBand, p1, p2], ...
%         {'5th-95th percentile','ISO Mean','ISO Range'}, ...
%         'Location','northwest', 'FontSize',6);
%     legend(ax(2),[p4,p5],{'ISO Mean','ISO Range'},'Location','southwest');
% else
%     legend(ax(1), hBand, {'5th-95th percentile'}, ...
%         'Location','northwest', 'FontSize',6);
% end
disp('done')
clear vars ax
%% VPA Plot - push-force mean curves with 5th-95th percentile band
f3 = customFigure('Impedance', 13, 8.5/2);
ax(1) = subplot(1,1,1);
hold(ax(1),"on");
grid(ax(1),"on");
box(ax(1),"on");
vpaMeanPlot = zeros(numel(resultsMatrix(1).freq_vec),nG);
vpaMeanModelPlot = zeros(numel(resultsMatrix(1).freq_vec),nG);
for gi = 1:1:nG
    cols = (FpTap == FpGroups(gi));
    col  = cmap(gi,:);
    [vpaMean, vpaLo, vpaHi] = bandStatsReal(abs(VPA_meas(:,cols)), prc);
    [vpaMeanModel, vpaLoModel, vpaHiModel] = bandStatsReal(abs(VPA_model(:,cols)), prc);
    vpaMeanPlot(:,gi) = vpaMean;
    vpaMeanModelPlot(:,gi) = vpaMeanModel;
    % fill(ax(1), [freq; flipud(freq)], [vpaLo; flipud(vpaHi)], col, ...
    %     'FaceAlpha',0.15, 'EdgeColor','none', 'HandleVisibility','off');
end
for gi = 1:1:nG
    cols = (FpTap == FpGroups(gi));
    col  = cmap(gi,:);
    plot(ax(1), freq, vpaMeanPlot(:,gi), 'LineWidth',1.0, 'Color',col, 'HandleVisibility','off');
    plot(ax(1), freq, vpaMeanModelPlot(:,gi), 'LineWidth',1.0, 'Color',col, 'HandleVisibility','off','LineStyle','-.');
end
hBandV = patch(ax(1), NaN, NaN, [0.6 0.6 0.6], 'FaceAlpha',0.15, 'EdgeColor','none');
set(ax(1), 'XScale','log');
xlabel(ax(1),'Frequency in Hz');
ylabel(ax(1), 'VPA in W');
% if directionLabel(1) == 'T'
%     ylim(ax(1), [0 0.5]);
% yticks([0 0.1 0.2 0.3 0.4 0.5])
% elseif directionLabel(1) == 'R'
%     ylim(ax(1), [0 0.15]);
% yticks([0 0.05 0.1 0.15])
% end
if directionLabel(1) == 'T' & directionExcitation == 'X' | directionLabel(1) == 'T' & directionExcitation == 'Z'
    xlim(ax(1), [10 500])
elseif directionLabel(1) == 'T' & directionExcitation == 'Y' | directionLabel(1) == 'R'
    xlim(ax(1), [10 100])
end
ax(1).Position = [0.10 0.22 0.67 0.74];
modifyFigure('fig', f3, ...
    'FontName', 'Arial', ...
    'FontSize', 8);
% Discrete colorbar for the push-force levels (replaces Fp legend)
colormap(ax(1), cmap);
clim(ax(1), [0.5 nG+0.5]);
c = colorbar(ax(1));
c.Ticks      = 1:nG;
c.TickLabels = cellstr(cbarLabels);
c.Position   = [0.80 0.22 0.02 0.74];
c.FontSize   = 6;
c.FontName   = 'Arial';
ax(1).Position = [0.10 0.22 0.67 0.74];    % reassert (colorbar resizes parent)
% Small legend for band only
legend(ax(1), hBandV, {'5th-95th percentile'}, ...
    'Location','northwest', 'FontSize',6);
disp('done')
clear vars ax
%% Save
if flag.save >0
saveFigure(f2,['\\ipek.kit.edu\dfs\Messdaten\Messdaten_8TB\4886_Impedanz_HAM-Modell_Spengler\003_HASim6_Simulationsmodell\04_Optimierung_3D_finetune\figures\MI_meas_' directionLabel(1) directionExcitation '_Fp_autoLim.emf']);
saveas(f2,['\\ipek.kit.edu\dfs\Messdaten\Messdaten_8TB\4886_Impedanz_HAM-Modell_Spengler\003_HASim6_Simulationsmodell\04_Optimierung_3D_finetune\figures\MI_meas_' directionLabel(1) directionExcitation '_Fp_autoLim.fig']);
saveFigure(f3,['\\ipek.kit.edu\dfs\Messdaten\Messdaten_8TB\4886_Impedanz_HAM-Modell_Spengler\003_HASim6_Simulationsmodell\04_Optimierung_3D_finetune\figures\VPA_meas_' directionLabel(1) directionExcitation '_Fp_autoLim.emf']);
saveas(f3,['\\ipek.kit.edu\dfs\Messdaten\Messdaten_8TB\4886_Impedanz_HAM-Modell_Spengler\003_HASim6_Simulationsmodell\04_Optimierung_3D_finetune\figures\VPA_meas_' directionLabel(1) directionExcitation '_Fp_autoLim.fig']);
end
end
%% ----------------------------------------------------------------------
function [m, lo, hi] = bandStatsReal(M, prc)
% Per-frequency arithmetic mean and percentile band for real-valued data.
% M: nFreq x nCurves
m  = mean(M, 2, 'omitnan');
lo = prctile(M, prc(1), 2);
hi = prctile(M, prc(2), 2);
end
function [phiMeanU, phiLoU, phiHiU] = bandStatsPhase(Z, prc)
% Per-frequency circular mean phase and percentile band on the wrapped
% phase deviations from the circular mean. The mean line is unwrapped over
% frequency for a continuous plot; the band edges follow the unwrapped mean.
% Z: nFreq x nCurves (complex)
U       = Z ./ max(abs(Z), eps);          % unit phasors (phase only)
Rmean   = mean(U, 2, 'omitnan');          % nFreq x 1 complex
phiMean = angle(Rmean);                    % wrapped circular mean
% wrapped deviation of each curve from the circular mean, in [-pi, pi]
dev = angle( U .* exp(-1j*phiMean) );      % nFreq x nCurves
loOff = prctile(dev, prc(1), 2);
hiOff = prctile(dev, prc(2), 2);
phiMeanU = unwrap(phiMean);                % smooth line for plotting
phiLoU   = phiMeanU + loOff;
phiHiU   = phiMeanU + hiOff;
end
 