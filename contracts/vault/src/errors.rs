//! Every panic message the vault can produce. The web app maps each one to a
//! friendly sentence in `web/lib/errors.ts`; keep the two lists in sync.

pub const ERR_NOT_OWNER: &str = "ERR_NOT_OWNER";
pub const ERR_NOT_REQUESTER: &str = "ERR_NOT_REQUESTER";
pub const ERR_NOT_PRINCIPAL_MEMBER: &str = "ERR_NOT_PRINCIPAL_MEMBER";
pub const ERR_SELF_APPROVAL: &str = "ERR_SELF_APPROVAL";
pub const ERR_RECEIVER_FLAGGED: &str = "ERR_RECEIVER_FLAGGED";
pub const ERR_INVALID_RECEIVER: &str = "ERR_INVALID_RECEIVER";
pub const ERR_INVALID_AMOUNT: &str = "ERR_INVALID_AMOUNT";
pub const ERR_INSUFFICIENT_AVAILABLE: &str = "ERR_INSUFFICIENT_AVAILABLE";
pub const ERR_TOO_MANY_PENDING: &str = "ERR_TOO_MANY_PENDING";
pub const ERR_INPUT_BOUNDS: &str = "ERR_INPUT_BOUNDS";
pub const ERR_UNKNOWN_FLAG: &str = "ERR_UNKNOWN_FLAG";
pub const ERR_NOT_PRINCIPAL: &str = "ERR_NOT_PRINCIPAL";
pub const ERR_NOT_PENDING: &str = "ERR_NOT_PENDING";
pub const ERR_NOT_EXPIRED: &str = "ERR_NOT_EXPIRED";
pub const ERR_NOT_YOUR_REQUEST: &str = "ERR_NOT_YOUR_REQUEST";
pub const ERR_NOT_AUTHORIZED_TO_REJECT: &str = "ERR_NOT_AUTHORIZED_TO_REJECT";
pub const ERR_REQUEST_NOT_FOUND: &str = "ERR_REQUEST_NOT_FOUND";
pub const ERR_INVALID_POLICY: &str = "ERR_INVALID_POLICY";
pub const ERR_NOT_FLAGGED: &str = "ERR_NOT_FLAGGED";
pub const ERR_MEMBER_NOT_FOUND: &str = "ERR_MEMBER_NOT_FOUND";
pub const ERR_PAYEE_NOT_FOUND: &str = "ERR_PAYEE_NOT_FOUND";

/// All error codes, exported through the `list_errors` view so tooling and
/// tests can check that the UI covers every one of them.
pub const ALL_ERRORS: &[&str] = &[
    ERR_NOT_OWNER,
    ERR_NOT_REQUESTER,
    ERR_NOT_PRINCIPAL_MEMBER,
    ERR_SELF_APPROVAL,
    ERR_RECEIVER_FLAGGED,
    ERR_INVALID_RECEIVER,
    ERR_INVALID_AMOUNT,
    ERR_INSUFFICIENT_AVAILABLE,
    ERR_TOO_MANY_PENDING,
    ERR_INPUT_BOUNDS,
    ERR_UNKNOWN_FLAG,
    ERR_NOT_PRINCIPAL,
    ERR_NOT_PENDING,
    ERR_NOT_EXPIRED,
    ERR_NOT_YOUR_REQUEST,
    ERR_NOT_AUTHORIZED_TO_REJECT,
    ERR_REQUEST_NOT_FOUND,
    ERR_INVALID_POLICY,
    ERR_NOT_FLAGGED,
    ERR_MEMBER_NOT_FOUND,
    ERR_PAYEE_NOT_FOUND,
];
