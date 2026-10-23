// Shared presentation helpers; database access belongs in models.
exports.initials = name => String(name || 'Student').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
exports.dateTime = value => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Thimphu', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(value)).replace(/\b(am|pm)\b/g, part => part.toUpperCase()) : 'Not specified';
exports.statusLabel = value => ({ pending: 'Applied', invited: 'Invited', accepted: 'Accepted', in_progress: 'Work in progress', completed: 'Completed', withdrawn: 'Withdrawn', declined: 'Declined', rejected: 'Rejected' }[value] || String(value).replace(/_/g, ' '));

exports.date = value => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Thimphu', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : 'Not specified';
