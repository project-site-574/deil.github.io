window.HELP_IMPROVE_VIDEOJS = false;

var INTERP_BASE = "./static/interpolation/stacked";
var NUM_INTERP_FRAMES = 240;

var interp_images = [];
function preloadInterpolationImages() {
  for (var i = 0; i < NUM_INTERP_FRAMES; i++) {
    var path = INTERP_BASE + '/' + String(i).padStart(6, '0') + '.jpg';
    interp_images[i] = new Image();
    interp_images[i].src = path;
  }
}

function setInterpolationImage(i) {
  var image = interp_images[i];
  image.ondragstart = function() { return false; };
  image.oncontextmenu = function() { return false; };
  $('#interpolation-image-wrapper').empty().append(image);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildTableFromRows(rows) {
  if (!rows || rows.length === 0) {
    return '<p class="has-text-grey">No rows found in the first worksheet.</p>';
  }

  var COLUMNS_PER_BLOCK = 6;
  var header = rows[0] || [];
  var bodyRows = rows.slice(1);

  var blocks = [
    { title: 'Depth Camera', matches: ['depth camera'] },
    { title: 'π³', matches: ['pi3'] },
    { title: 'VGGT', matches: ['vggt'] },
    { title: 'MoGe', matches: ['moge'] },
    { title: 'Mast3r', matches: ['mast3r', 'masr3r'] },
    { title: 'MapAnything', matches: ['mapanything'] },
    { title: 'MapAnything_no_ext', matches: ['mapanything_no_ext', 'mapanythingnoext'] }
  ];

  var displayHeader = header.slice(0, COLUMNS_PER_BLOCK);
  while (displayHeader.length < COLUMNS_PER_BLOCK) {
    displayHeader.push('');
  }

  function toThreeDigits(value) {
    if (value === '' || value == null) {
      return '';
    }

    var num = Number(value);
    if (!Number.isFinite(num)) {
      return value;
    }

    return num.toFixed(3);
  }

  function isSrColumn(columnName) {
    var normalized = normalizeText(columnName);
    return normalized === 'sr' || normalized === 'srstd';
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  var estimatorIndex = header.findIndex(function(cell) {
    return normalizeText(cell).indexOf('depthestimator') !== -1;
  });

  var srValueIndex = header.findIndex(function(cell) {
    return normalizeText(cell) === 'sr';
  });

  var estimatorDisplayIndex = displayHeader.findIndex(function(cell) {
    return normalizeText(cell).indexOf('depthestimator') !== -1;
  });

  function matchesBlock(row, block) {
    if (estimatorIndex < 0) {
      return false;
    }

    var estimatorValue = normalizeText((row || [])[estimatorIndex]);
    return block.matches.some(function(alias) {
      return estimatorValue === normalizeText(alias);
    });
  }

  function buildSingleBlockTable(block) {
    var rowsForBlock = bodyRows.filter(function(row) {
      return matchesBlock(row, block);
    });

    var bestRowIndex = -1;
    if (srValueIndex >= 0) {
      var bestSr = -Infinity;
      rowsForBlock.forEach(function(row, index) {
        var sr = Number((row || [])[srValueIndex]);
        if (Number.isFinite(sr) && sr > bestSr) {
          bestSr = sr;
          bestRowIndex = index;
        }
      });
    }

    var srColumnMask = displayHeader.map(function(columnName) {
      return isSrColumn(columnName);
    });

    var thead = '<thead><tr>' + displayHeader.map(function(cell) {
      return '<th>' + escapeHtml(cell == null ? '' : cell) + '</th>';
    }).join('') + '</tr></thead>';

    var tbody = '<tbody>' + rowsForBlock.map(function(row, rowIndex) {
      var values = (row || []).slice(0, COLUMNS_PER_BLOCK);
      while (values.length < COLUMNS_PER_BLOCK) {
        values.push('');
      }

      values = values.map(function(cell, index) {
        if (index === estimatorDisplayIndex && normalizeText(cell) === 'pi3') {
          return 'π³';
        }
        if (srColumnMask[index]) {
          return toThreeDigits(cell);
        }
        return cell;
      });

      var isBest = rowIndex === bestRowIndex;
      var rowStyle = isBest ? ' style="background-color:#fff8db;font-weight:700;"' : '';

      return '<tr' + rowStyle + '>' + values.map(function(cell) {
        return '<td>' + escapeHtml(cell == null ? '' : cell) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';

    return '' +
      '<div class="content mb-3"><h4 class="title is-6">' + escapeHtml(block.title) + '</h4></div>' +
      '<div class="table-container">' +
      '<table class="table is-fullwidth is-striped is-hoverable is-bordered simulation-results-table">' +
      thead + tbody +
      '</table>' +
      '</div>';
  }

  if (estimatorIndex < 0) {
    return '<p class="has-text-warning">Could not find a "Depth Estimator" column in the Excel header.</p>';
  }

  return '' +
    '<div class="columns is-centered"><div class="column is-full">' + buildSingleBlockTable(blocks[0]) + '</div></div>' +
    '<div class="columns"><div class="column is-half">' + buildSingleBlockTable(blocks[1]) + '</div><div class="column is-half">' + buildSingleBlockTable(blocks[2]) + '</div></div>' +
    '<div class="columns"><div class="column is-half">' + buildSingleBlockTable(blocks[3]) + '</div><div class="column is-half">' + buildSingleBlockTable(blocks[4]) + '</div></div>' +
    '<div class="columns"><div class="column is-half">' + buildSingleBlockTable(blocks[5]) + '</div><div class="column is-half">' + buildSingleBlockTable(blocks[6]) + '</div></div>';
}

function renderSimulationResultsAppendix() {
  var status = document.getElementById('simulation-results-status');
  var tableContainer = document.getElementById('simulation-results-table');
  if (!status || !tableContainer || typeof XLSX === 'undefined') {
    return;
  }

  var excelPath = './static/data/PHS.xlsx';

  fetch(excelPath)
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Cannot load ' + excelPath + '. Add your Excel file there.');
      }
      return response.arrayBuffer();
    })
    .then(function(buffer) {
      var workbook = XLSX.read(buffer, { type: 'array' });
      var firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('The workbook has no worksheets.');
      }

      var worksheet = workbook.Sheets[firstSheetName];
      var rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: ''
      });

      tableContainer.innerHTML = buildTableFromRows(rows);
      status.style.display = 'none';
    })
    .catch(function(error) {
      status.style.display = '';
      status.className = 'notification is-warning is-light';
      status.textContent = error.message;
      tableContainer.innerHTML = '<p class="has-text-grey">Tip: Place your Excel file at ./static/data/depth_estimated_instant_policy.xlsx</p>';
      console.error(error);
    });
}


$(document).ready(function() {
    // Check for click events on the navbar burger icon
    $(".navbar-burger").click(function() {
      // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
      $(".navbar-burger").toggleClass("is-active");
      $(".navbar-menu").toggleClass("is-active");

    });

    var options = {
			slidesToScroll: 1,
			slidesToShow: 3,
			loop: true,
			infinite: true,
			autoplay: false,
			autoplaySpeed: 3000,
    }

		// Initialize all div with carousel class
    var carousels = bulmaCarousel.attach('.carousel', options);

    // Loop on each carousel initialized
    for(var i = 0; i < carousels.length; i++) {
    	// Add listener to  event
    	carousels[i].on('before:show', state => {
    		console.log(state);
    	});
    }

    // Access to bulmaCarousel instance of an element
    var element = document.querySelector('#my-element');
    if (element && element.bulmaCarousel) {
    	// bulmaCarousel instance is available as element.bulmaCarousel
    	element.bulmaCarousel.on('before-show', function(state) {
    		console.log(state);
    	});
    }

    /*var player = document.getElementById('interpolation-video');
    player.addEventListener('loadedmetadata', function() {
      $('#interpolation-slider').on('input', function(event) {
        console.log(this.value, player.duration);
        player.currentTime = player.duration / 100 * this.value;
      })
    }, false);*/
    preloadInterpolationImages();

    $('#interpolation-slider').on('input', function(event) {
      setInterpolationImage(this.value);
    });
    setInterpolationImage(0);
    $('#interpolation-slider').prop('max', NUM_INTERP_FRAMES - 1);

    bulmaSlider.attach();
    renderSimulationResultsAppendix();

})
