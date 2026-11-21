$(function () {
  function loadHistory() {
    $.getJSON('/api/history', function (rows) {
      var $body = $('#historyBody').empty();
      rows.forEach(function (r) {
        var $tr = $('<tr>');
        $tr.append($('<td>').text(new Date(r.createdAt).toLocaleString()));
        $tr.append($('<td>').text(r.principal));
        $tr.append($('<td>').text(r.rate));
        $tr.append($('<td>').text(r.months));
        $tr.append($('<td>').text(r.emi));
        $tr.append($('<td>').text(r.servedBy));
        $body.append($tr);
      });
    });
  }

  $('#emiForm').on('submit', function (e) {
    e.preventDefault(); // no postback
    var principal = parseFloat($('#principal').val());
    var rate = parseFloat($('#rate').val());
    var months = parseInt($('#months').val(), 10);

    // Client-side validation: positive numbers only.
    if (!(principal > 0) || !(rate > 0) || !(months > 0)) {
      $('#formError').text('All fields must be positive numbers.');
      return;
    }
    $('#formError').text('');

    $.ajax({
      url: '/api/emi',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ principal: principal, rate: rate, months: months }),
      success: function (res) {
        $('#rEmi').text(res.emi.toFixed(2));
        $('#rTotal').text(res.totalPayment.toFixed(2));
        $('#rInterest').text(res.totalInterest.toFixed(2));
        $('#rPod').text(res.servedBy);
        $('#rIp').text(res.podIp);
        $('#resultPanel').removeClass('d-none');
        loadHistory();
      },
      error: function (xhr) {
        var msg = (xhr.responseJSON && xhr.responseJSON.error) || 'Request failed';
        $('#formError').text(msg);
      }
    });
  });

  loadHistory();
});
