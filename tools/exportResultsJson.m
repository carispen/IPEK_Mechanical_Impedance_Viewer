function exportResultsJson(resultsMatrix, dirCode, outDir)
% Export a resultsMatrix struct array as one JSON file per subject for the web viewer:
%   <outDir>/<dirCode>/S<nn>.json   measurements of one subject
%   <outDir>/<dirCode>/index.json   subject numbers available in this direction
% Values are written unchanged (measurement data). MI and the excitation acceleration ajw
% are stored complex as MIre/MIim and ajwRe/ajwIm; the viewer computes |MI|, the phase
% (atan2, like angle()) and the excitation velocity for the model VPA itself.
% Only the usable entry MI(:, forceDir, accDir) / VPA(:, forceDir, accDir) is exported.
%
% Example: exportResultsJson(resultsMatrix, 'RX', 'data')

dirPath = fullfile(outDir, dirCode);
if ~exist(dirPath, 'dir'), mkdir(dirPath); end

subjects = unique([resultsMatrix.SubjectNumber]);
for s = subjects
    R = resultsMatrix([resultsMatrix.SubjectNumber] == s);
    freq = double(R(1).freq_vec(:)');
    rows = cell(1, numel(R));
    for n = 1:numel(R)
        r = R(n);
        assert(isequal(double(r.freq_vec(:)'), freq), 'Subject %d: rows have different freq_vec', s);
        % .' (not ') as transpose: ' would conjugate and flip the sign of the imaginary part
        mi = r.MI(:, r.forceDir, r.accDir).';
        rows{n} = struct( ...
            'TargetPushForce', r.TargetPushForce, 'TargetGripForce', r.TargetGripForce, ...
            'MeanPushForce',   r.MeanPushForce,   'MeanGripForce',   r.MeanGripForce, ...
            'MaxPushForce',    r.MaxPushForce,    'MaxGripForce',    r.MaxGripForce, ...
            'MIre', real(mi), 'MIim', imag(mi), ...
            'ajwRe', real(r.ajw(:).'), 'ajwIm', imag(r.ajw(:).'), ...
            'VPA',  r.VPA(:, r.forceDir, r.accDir).');
    end
    % rows as a cell array, so a single row still becomes a JSON array
    writeJson(fullfile(dirPath, sprintf('S%02d.json', s)), ...
        struct('SubjectNumber', s, 'direction', dirCode, 'freq', freq, 'rows', {rows}));
end
% cell array, so a single subject still becomes a JSON array
writeJson(fullfile(dirPath, 'index.json'), struct('subjects', {num2cell(subjects)}));
fprintf('%s: %d subjects, %d rows -> %s\n', dirCode, numel(subjects), numel(resultsMatrix), dirPath);
end

function writeJson(file, data)
fid = fopen(file, 'w');
fwrite(fid, jsonencode(data), 'char');
fclose(fid);
end
